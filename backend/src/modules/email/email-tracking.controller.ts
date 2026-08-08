import { Request, Response } from 'express';
import pool from '../../db';
import { AuthRequest } from '../../middleware/auth';

// 1×1 transparent GIF
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

// ─── GET /email/track/open/:trackingId ────────────────────────────────────────

export const handleOpenPixel = async (req: Request, res: Response) => {
  res.set({
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    Expires: '0',
  }).send(TRACKING_PIXEL);

  try {
    const { trackingId } = req.params;
    const recipientRes = await pool.query(
      `SELECT id, campaign_id, tenant_id FROM email_campaign_recipients WHERE tracking_id = $1`,
      [trackingId],
    );
    if (recipientRes.rows.length === 0) return;
    const { id: recipientId, campaign_id, tenant_id } = recipientRes.rows[0];

    await pool.query(
      `INSERT INTO email_events (tenant_id, campaign_id, recipient_id, event_type, ip_address)
       VALUES ($1, $2, $3, 'open', $4)`,
      [tenant_id, campaign_id, recipientId, req.ip],
    );

    await pool.query(
      `UPDATE email_campaigns
       SET opened_count = (
         SELECT COUNT(DISTINCT recipient_id)::int FROM email_events
         WHERE campaign_id = $1 AND event_type = 'open'
       ), updated_at = now()
       WHERE id = $1`,
      [campaign_id],
    );
  } catch {
    // Silently fail — never break email rendering
  }
};

// ─── GET /email/track/click/:trackingId ──────────────────────────────────────

export const handleClickRedirect = async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  const { trackingId } = req.params;

  if (!targetUrl) return res.status(400).send('Missing url');

  try {
    const parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).send('Invalid URL');
    }
  } catch {
    return res.status(400).send('Invalid URL');
  }

  // Validate trackingId exists BEFORE redirecting — prevents open-redirect abuse
  // (unauthenticated endpoint should only redirect URLs recorded by this platform)
  try {
    const recipientRes = await pool.query(
      `SELECT id, campaign_id, tenant_id FROM email_campaign_recipients WHERE tracking_id = $1`,
      [trackingId],
    );
    if (recipientRes.rows.length === 0) {
      return res.status(404).send('Invalid tracking link');
    }
    const { id: recipientId, campaign_id, tenant_id } = recipientRes.rows[0];

    res.redirect(302, targetUrl);

    // Record click event after the redirect is sent
    try {
      await pool.query(
        `INSERT INTO email_events (tenant_id, campaign_id, recipient_id, event_type, metadata, ip_address)
         VALUES ($1, $2, $3, 'click', $4, $5)`,
        [tenant_id, campaign_id, recipientId, JSON.stringify({ url: targetUrl }), req.ip],
      );
      await pool.query(
        `UPDATE email_campaigns
         SET clicked_count = (
           SELECT COUNT(DISTINCT recipient_id)::int FROM email_events
           WHERE campaign_id = $1 AND event_type = 'click'
         ), updated_at = now()
         WHERE id = $1`,
        [campaign_id],
      );
    } catch {
      // Tracking failure must never surface to the user
    }
  } catch (err) {
    if (!res.headersSent) res.status(400).send('Invalid tracking link');
  }
};

// ─── GET /email/unsubscribe/:trackingId ──────────────────────────────────────

export const handleUnsubscribe = async (req: Request, res: Response) => {
  const { trackingId } = req.params;

  const page = (title: string, body: string) =>
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head>
     <body style="font-family:sans-serif;padding:48px;text-align:center;max-width:480px;margin:0 auto;color:#374151">
       <h2>${title}</h2><p style="color:#6b7280">${body}</p>
     </body></html>`;

  try {
    const recipientRes = await pool.query(
      `SELECT id, campaign_id, tenant_id, email FROM email_campaign_recipients WHERE tracking_id = $1`,
      [trackingId],
    );

    if (recipientRes.rows.length === 0) {
      return res.send(page('Invalid link', 'This unsubscribe link is no longer valid.'));
    }

    const { id: recipientId, campaign_id, tenant_id, email } = recipientRes.rows[0];

    await pool.query(
      `INSERT INTO email_unsubscribes (tenant_id, email, campaign_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, email) DO NOTHING`,
      [tenant_id, email, campaign_id],
    );

    await pool.query(
      `INSERT INTO email_events (tenant_id, campaign_id, recipient_id, event_type)
       VALUES ($1, $2, $3, 'unsubscribe')`,
      [tenant_id, campaign_id, recipientId],
    );

    await pool.query(
      `UPDATE email_campaigns
       SET unsubscribed_count = unsubscribed_count + 1, updated_at = now()
       WHERE id = $1`,
      [campaign_id],
    );

    res.send(page(
      'Unsubscribed successfully',
      'You have been removed from this mailing list and will no longer receive these emails.',
    ));
  } catch (err) {
    console.error('Unsubscribe error:', err);
    res.send(page('Error', 'Something went wrong. Please try again later.'));
  }
};

// ─── GET /email-campaigns/:id/analytics ──────────────────────────────────────

export const getCampaignAnalytics = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const { id } = req.params;

  try {
    const [campaignRes, statsRes, clicksRes, statusRes] = await Promise.all([
      pool.query(
        `SELECT * FROM email_campaigns WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId],
      ),
      pool.query(
        `SELECT
           COUNT(DISTINCT CASE WHEN event_type = 'open'        THEN recipient_id END)::int AS unique_opens,
           COUNT(CASE WHEN event_type = 'open' THEN 1 END)::int                            AS total_opens,
           COUNT(DISTINCT CASE WHEN event_type = 'click'       THEN recipient_id END)::int AS unique_clicks,
           COUNT(CASE WHEN event_type = 'click' THEN 1 END)::int                           AS total_clicks,
           COUNT(DISTINCT CASE WHEN event_type = 'unsubscribe' THEN recipient_id END)::int AS unsubscribes
         FROM email_events WHERE campaign_id = $1`,
        [id],
      ),
      pool.query(
        `SELECT metadata->>'url' AS url, COUNT(*)::int AS clicks
         FROM email_events
         WHERE campaign_id = $1 AND event_type = 'click' AND metadata->>'url' IS NOT NULL
         GROUP BY url ORDER BY clicks DESC LIMIT 10`,
        [id],
      ),
      pool.query(
        `SELECT status, COUNT(*)::int AS count
         FROM email_campaign_recipients WHERE campaign_id = $1
         GROUP BY status`,
        [id],
      ),
    ]);

    if (campaignRes.rows.length === 0) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    const campaign = campaignRes.rows[0];
    const s = statsRes.rows[0];
    const delivered = campaign.delivered_count || 0;

    const statusMap: Record<string, number> = {};
    statusRes.rows.forEach((r) => { statusMap[r.status] = r.count; });

    res.json({
      campaign,
      analytics: {
        delivered,
        unique_opens:  s.unique_opens,
        total_opens:   s.total_opens,
        unique_clicks: s.unique_clicks,
        total_clicks:  s.total_clicks,
        unsubscribes:  s.unsubscribes,
        bounced:       statusMap.bounced || 0,
        failed:        statusMap.failed  || 0,
        open_rate:     delivered > 0 ? parseFloat(((s.unique_opens  / delivered) * 100).toFixed(1)) : 0,
        click_rate:    delivered > 0 ? parseFloat(((s.unique_clicks / delivered) * 100).toFixed(1)) : 0,
      },
      top_links: clicksRes.rows,
    });
  } catch (err) {
    console.error('Campaign analytics error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── GET /email-campaigns/:id/recipients ─────────────────────────────────────

export const getCampaignRecipients = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const { id } = req.params;

  try {
    const campRes = await pool.query(
      `SELECT id FROM email_campaigns WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (campRes.rows.length === 0) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    const result = await pool.query(
      `SELECT
         r.id, r.email, r.name, r.status, r.delivered_at, r.bounce_reason,
         MAX(CASE WHEN e.event_type = 'open'  THEN e.created_at END)  AS last_opened_at,
         MAX(CASE WHEN e.event_type = 'click' THEN e.created_at END)  AS last_clicked_at,
         COUNT(CASE WHEN e.event_type = 'open'  THEN 1 END)::int      AS open_count,
         COUNT(CASE WHEN e.event_type = 'click' THEN 1 END)::int      AS click_count,
         BOOL_OR(e.event_type = 'unsubscribe')                        AS unsubscribed
       FROM email_campaign_recipients r
       LEFT JOIN email_events e ON e.recipient_id = r.id
       WHERE r.campaign_id = $1 AND r.tenant_id = $2
       GROUP BY r.id
       ORDER BY r.created_at`,
      [id, tenantId],
    );

    res.json({ recipients: result.rows });
  } catch (err) {
    console.error('Campaign recipients error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── GET /email/unsubscribes ──────────────────────────────────────────────────

export const listUnsubscribes = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.unsubscribed_at, c.name AS campaign_name
       FROM email_unsubscribes u
       LEFT JOIN email_campaigns c ON c.id = u.campaign_id
       WHERE u.tenant_id = $1
       ORDER BY u.unsubscribed_at DESC`,
      [tenantId],
    );
    res.json({ unsubscribes: result.rows });
  } catch (err) {
    console.error('List unsubscribes error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── DELETE /email/unsubscribes/:email ───────────────────────────────────────

export const removeUnsubscribe = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const email = decodeURIComponent(req.params.email as string);
  try {
    await pool.query(
      `DELETE FROM email_unsubscribes WHERE tenant_id = $1 AND email = $2`,
      [tenantId, email],
    );
    res.json({ message: 'Removed from unsubscribe list' });
  } catch (err) {
    console.error('Remove unsubscribe error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
