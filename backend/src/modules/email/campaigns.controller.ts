import { Response } from 'express';
import pool from '../../db';
import { AuthRequest } from '../../middleware/auth';
import { getUserTransporter, getTenantTransporter, classifySmtpError } from './email.controller';

// ─── Internal helper: send a single email via user/tenant SMTP ────────────────

async function sendSingleEmail(
  tenantId: string,
  to: string,
  subject: string,
  body: string,
  userId?: string,
): Promise<void> {
  let mailer = userId ? await getUserTransporter(userId) : null;
  if (!mailer) {
    mailer = await getTenantTransporter(tenantId);
  }
  if (!mailer) {
    throw new Error('EMAIL_NOT_CONFIGURED: No SMTP configuration found.');
  }
  await mailer.transporter.sendMail({
    from: mailer.fromEmail,
    to,
    subject,
    text: body,
    html: `<div style="font-family:sans-serif;white-space:pre-wrap;line-height:1.6">${body}</div>`,
  });
}

// ─── Tracking HTML builder ────────────────────────────────────────────────────

function buildTrackedHtml(
  body: string,
  trackingId: string,
  baseUrl: string,
  trackOpens: boolean,
  trackClicks: boolean,
): string {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const withLinks = trackClicks
    ? escaped.replace(
        /(https?:\/\/[^\s<>"&]+)/g,
        (url) =>
          `<a href="${baseUrl}/v1/email/track/click/${trackingId}?url=${encodeURIComponent(url)}" style="color:#2563eb">${url}</a>`,
      )
    : escaped;

  const pixel = trackOpens
    ? `<img src="${baseUrl}/v1/email/track/open/${trackingId}" width="1" height="1" border="0" alt="" style="display:block;width:1px;height:1px" />`
    : '';

  return `${pixel}<div style="font-family:sans-serif;white-space:pre-wrap;line-height:1.6;color:#374151">${withLinks}</div>
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#9ca3af">
  <a href="${baseUrl}/v1/email/unsubscribe/${trackingId}" style="color:#9ca3af;text-decoration:underline">Unsubscribe</a>
</div>`;
}

// ─── GET /email-campaigns ─────────────────────────────────────────────────────

export const listCampaigns = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const pageLimit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "200"), 10) || 200));
  const pageOffset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);
  try {
    const result = await pool.query(
      `SELECT id, name, subject, body, status,
              recipient_count, delivered_count, opened_count,
              clicked_count, bounced_count, unsubscribed_count,
              scheduled_at, sent_at, created_by, created_at, updated_at
       FROM email_campaigns
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, pageLimit, pageOffset],
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List campaigns error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── POST /email-campaigns ────────────────────────────────────────────────────

export const createCampaign = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const userId = req.user!.id;
  const { name, subject, body, status = 'draft' } = req.body;

  if (!name?.trim() || !subject?.trim() || !body?.trim()) {
    return res.status(400).json({ message: 'name, subject, and body are required.' });
  }
  const allowedStatuses = ['draft', 'scheduled', 'sending', 'sent', 'failed'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO email_campaigns
         (tenant_id, name, subject, body, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenantId, name.trim(), subject.trim(), body.trim(), status, userId],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── POST /email-campaigns/:id/send ──────────────────────────────────────────
// BUG FIX 1: Token substitution — replace {{first_name}}, {{last_name}},
//            {{full_name}}, {{email}}, {{job_title}}, {{company}} per recipient.
// BUG FIX 2: Schedule — if scheduled_at is provided and in the future,
//            store status='scheduled' and return early without sending.

export const sendCampaignById = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const userId = req.user!.id;
  const { id } = req.params;
  const {
    recipients: recipientsRaw,
    recipient_ids,
    track_opens = true,
    track_clicks = true,
    scheduled_at,
  } = req.body;

  // BUG FIX 2: If scheduled_at is provided and is in the future, save as scheduled
  // and return without sending. A cron job will pick this up later.
  if (scheduled_at) {
    const scheduledDate = new Date(scheduled_at);
    if (!isNaN(scheduledDate.getTime()) && scheduledDate > new Date()) {
      try {
        // Resolve recipients now and persist them so the scheduler can fire later
        let sched: Array<{ email: string; first_name?: string; last_name?: string; name?: string }> = [];
        if (Array.isArray(recipientsRaw) && recipientsRaw.length > 0) {
          sched = recipientsRaw;
        } else if (Array.isArray(recipient_ids) && recipient_ids.length > 0) {
          const rows = await pool.query(
            `SELECT email, first_name, last_name FROM candidates WHERE id = ANY($1::uuid[]) AND tenant_id = $2`,
            [recipient_ids, tenantId],
          );
          sched = rows.rows;
        }

        await pool.query(
          `UPDATE email_campaigns
           SET status = 'scheduled', scheduled_at = $1, recipient_count = $2, updated_at = now()
           WHERE id = $3 AND tenant_id = $4`,
          [scheduledDate.toISOString(), sched.length, id, tenantId],
        );

        for (const r of sched) {
          const fullName = ((r.first_name || '') + ' ' + (r.last_name || '')).trim() || r.name || null;
          await pool.query(
            `INSERT INTO email_campaign_recipients (tenant_id, campaign_id, email, name)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (campaign_id, email) DO UPDATE SET status = 'pending', bounce_reason = NULL`,
            [tenantId, id, r.email, fullName],
          );
        }

        return res.json({
          message: 'Campaign scheduled',
          scheduled_at: scheduledDate.toISOString(),
          recipients: sched.length,
        });
      } catch (error) {
        console.error('Schedule campaign error:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }
    }
  }

  // Accept either recipients:[{email, first_name, last_name, name}]
  // or recipient_ids:[uuid] with DB lookup
  let recipients: Array<{
    email: string;
    first_name?: string;
    last_name?: string;
    name?: string;
  }> = [];

  if (Array.isArray(recipientsRaw) && recipientsRaw.length > 0) {
    recipients = recipientsRaw;
  } else if (Array.isArray(recipient_ids) && recipient_ids.length > 0) {
    const res2 = await pool.query(
      `SELECT email, first_name, last_name
       FROM candidates WHERE id = ANY($1::uuid[]) AND tenant_id = $2`,
      [recipient_ids, tenantId],
    );
    recipients = res2.rows;
  }

  if (recipients.length === 0) {
    return res.status(400).json({ message: 'recipients array is required.' });
  }

  try {
    const campResult = await pool.query(
      `SELECT * FROM email_campaigns WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (campResult.rows.length === 0) {
      return res.status(404).json({ message: 'Campaign not found.' });
    }
    const campaign = campResult.rows[0];

    const userMail = await getUserTransporter(userId);
    if (!userMail) {
      return res.status(400).json({
        code: 'EMAIL_NOT_CONFIGURED',
        message: 'Email not configured. Go to Settings → Email to connect your email.',
      });
    }

    // Filter out unsubscribed recipients
    const unsubRes = await pool.query(
      `SELECT email FROM email_unsubscribes WHERE tenant_id = $1`,
      [tenantId],
    );
    const unsubSet = new Set(
      unsubRes.rows.map((r: { email: string }) => r.email.toLowerCase()),
    );
    const eligible = recipients.filter((r) => !unsubSet.has(r.email.toLowerCase()));
    const unsubCount = recipients.length - eligible.length;

    await pool.query(
      `UPDATE email_campaigns
       SET status = 'sending', recipient_count = $1, track_opens = $2, track_clicks = $3, updated_at = now()
       WHERE id = $4`,
      [recipients.length, track_opens, track_clicks, id],
    );

    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';

    // Insert recipient rows and collect tracking IDs
    const recipientRows = await Promise.all(
      eligible.map(async (r) => {
        const fullName =
          ((r.first_name || '') + ' ' + (r.last_name || '')).trim() || r.name || null;
        const ins = await pool.query(
          `INSERT INTO email_campaign_recipients (tenant_id, campaign_id, email, name)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (campaign_id, email) DO UPDATE SET status = 'pending', bounce_reason = NULL
           RETURNING id, tracking_id`,
          [tenantId, id, r.email, fullName],
        );
        return {
          ...r,
          recipientId: ins.rows[0].id,
          trackingId: ins.rows[0].tracking_id,
        };
      }),
    );

    const sendResults = await Promise.allSettled(
      recipientRows.map(async (r) => {
        // BUG FIX 1: Apply per-recipient token substitution before sending.
        const personalizedBody = (campaign.body || '')
          .replace(/{{first_name}}/gi, r.first_name || '')
          .replace(/{{last_name}}/gi, r.last_name || '')
          .replace(
            /{{full_name}}/gi,
            ((r.first_name || '') + ' ' + (r.last_name || '')).trim(),
          )
          .replace(/{{email}}/gi, r.email || '')
          .replace(/{{job_title}}/gi, campaign.job_title || '')
          .replace(/{{company}}/gi, campaign.company_name || '');

        const personalizedSubject = (campaign.subject || '')
          .replace(/{{first_name}}/gi, r.first_name || '')
          .replace(/{{last_name}}/gi, r.last_name || '')
          .replace(
            /{{full_name}}/gi,
            ((r.first_name || '') + ' ' + (r.last_name || '')).trim(),
          )
          .replace(/{{email}}/gi, r.email || '')
          .replace(/{{job_title}}/gi, campaign.job_title || '')
          .replace(/{{company}}/gi, campaign.company_name || '');

        const html = buildTrackedHtml(
          personalizedBody,
          r.trackingId,
          baseUrl,
          track_opens,
          track_clicks,
        );

        try {
          await userMail.transporter.sendMail({
            from: userMail.fromEmail,
            to: r.email,
            subject: personalizedSubject,
            text: personalizedBody,
            html,
          });
          await pool.query(
            `UPDATE email_campaign_recipients SET status = 'delivered', delivered_at = now() WHERE id = $1`,
            [r.recipientId],
          );
          return true;
        } catch (err: any) {
          await pool.query(
            `UPDATE email_campaign_recipients SET status = 'failed', bounce_reason = $1 WHERE id = $2`,
            [String(err?.message ?? '').substring(0, 255), r.recipientId],
          );
          return false;
        }
      }),
    );

    const deliveredCount = sendResults.filter(
      (r) => r.status === 'fulfilled' && r.value === true,
    ).length;

    await pool.query(
      `UPDATE email_campaigns
       SET status = 'sent', delivered_count = $1, unsubscribed_count = $2, sent_at = now(), updated_at = now()
       WHERE id = $3`,
      [deliveredCount, unsubCount, id],
    );

    const updated = await pool.query(`SELECT * FROM email_campaigns WHERE id = $1`, [id]);

    res.json({
      message: 'Campaign sent',
      delivered_count: deliveredCount,
      recipients: recipients.length,
      unsubscribed_skipped: unsubCount,
      campaign: updated.rows[0],
    });
  } catch (error: any) {
    console.error('Send campaign error:', error);
    const { code, message } = classifySmtpError(error);
    res.status(500).json({ code, message });
  }
};

// ─── DELETE /email-campaigns/:id ─────────────────────────────────────────────

export const deleteCampaign = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM email_campaigns WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Campaign not found.' });
    }
    res.json({ message: 'Campaign deleted.' });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Scheduler helper: dispatch a claimed campaign ───────────────────────────
// Called by scheduler.ts after atomically claiming campaigns (status='sending').
// Reads pre-populated pending recipients from email_campaign_recipients.

export async function dispatchScheduledCampaign(
  campaignId: string,
  tenantId: string,
  createdBy?: string,
): Promise<{ deliveredCount: number; failedCount: number }> {
  const campResult = await pool.query(
    `SELECT * FROM email_campaigns WHERE id = $1 AND tenant_id = $2`,
    [campaignId, tenantId],
  );
  const campaign = campResult.rows[0];
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  const userId = createdBy || campaign.created_by;
  let userMail = userId ? await getUserTransporter(userId) : null;
  if (!userMail) userMail = await getTenantTransporter(tenantId);
  if (!userMail) throw new Error('EMAIL_NOT_CONFIGURED: No SMTP configuration found.');

  const unsubRes = await pool.query(
    `SELECT email FROM email_unsubscribes WHERE tenant_id = $1`,
    [tenantId],
  );
  const unsubSet = new Set<string>(
    unsubRes.rows.map((r: { email: string }) => r.email.toLowerCase()),
  );

  const recipientRes = await pool.query(
    `SELECT id, email, name, tracking_id FROM email_campaign_recipients
     WHERE campaign_id = $1 AND status = 'pending'`,
    [campaignId],
  );
  const eligible = recipientRes.rows.filter(
    (r) => !unsubSet.has(r.email.toLowerCase()),
  );

  const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  const track_opens: boolean = campaign.track_opens ?? true;
  const track_clicks: boolean = campaign.track_clicks ?? true;

  let deliveredCount = 0;
  let failedCount = 0;

  for (const r of eligible) {
    const name = r.name || '';
    const personalizedBody = (campaign.body || '')
      .replace(/{{full_name}}/gi, name)
      .replace(/{{email}}/gi, r.email);
    const personalizedSubject = (campaign.subject || '')
      .replace(/{{full_name}}/gi, name)
      .replace(/{{email}}/gi, r.email);
    const html = buildTrackedHtml(
      personalizedBody,
      r.tracking_id,
      baseUrl,
      track_opens,
      track_clicks,
    );
    try {
      await userMail.transporter.sendMail({
        from: userMail.fromEmail,
        to: r.email,
        subject: personalizedSubject,
        text: personalizedBody,
        html,
      });
      await pool.query(
        `UPDATE email_campaign_recipients SET status = 'delivered', delivered_at = now() WHERE id = $1`,
        [r.id],
      );
      deliveredCount++;
    } catch (err: any) {
      await pool.query(
        `UPDATE email_campaign_recipients SET status = 'failed', bounce_reason = $1 WHERE id = $2`,
        [String(err?.message ?? '').substring(0, 255), r.id],
      );
      failedCount++;
    }
  }

  return { deliveredCount, failedCount };
}

// ─── POST /email-campaigns/test-send ─────────────────────────────────────────
// NEW FEATURE: Send a test email with all tokens replaced by '[TEST]'.

export const sendTestEmail = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { campaign_id, test_email } = req.body;
  if (!campaign_id || !test_email) {
    return res.status(400).json({ message: 'campaign_id and test_email required' });
  }
  try {
    const camp = await pool.query(
      'SELECT * FROM email_campaigns WHERE id=$1 AND tenant_id=$2',
      [campaign_id, tenantId],
    );
    if (!camp.rows[0]) return res.status(404).json({ message: 'Campaign not found' });
    const c = camp.rows[0];
    // Replace all tokens with '[TEST]' placeholder for preview
    const subject = (c.subject || 'Test').replace(/{{[^}]+}}/g, '[TEST]');
    const body = (c.body || '').replace(/{{[^}]+}}/g, '[TEST]');
    // Use the existing SMTP logic via the internal sendSingleEmail helper
    await sendSingleEmail(tenantId!, test_email, subject, body, req.user?.id);
    res.json({ message: 'Test email sent to ' + test_email });
  } catch (err) {
    console.error('sendTestEmail error:', err);
    res.status(500).json({ error: 'Failed to send test email' });
  }
};
