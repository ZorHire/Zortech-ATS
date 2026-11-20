import { Response } from "express";
import pool from "../../db";
import { createCandidateFromProspect } from "./linkedin.controller";
import { processNewProspects } from "./linkedinAi";
import { buildPeopleSearchUrl, normalizeFilters, RESOLVABLE, RecruiterSearchSchema } from "./linkedinSearch";
import { DAILY_INVITE_CAP_PER_USER, ExtRequest, getAccount, inviteCounts, logAction, UUID_RE, WEEKLY_INVITE_CAP } from "./linkedinStore";

/**
 * Endpoints the ZorHire Chrome extension calls (/v1/linkedin-agent/ext/*), authenticated
 * by its connection token. The extension does all LinkedIn work inside the recruiter's
 * own browser session; these endpoints only hand out work and record results.
 */

const fail = (res: Response, where: string, err: unknown) => {
  console.error(`linkedin-agent ext ${where} error:`, err);
  res.status(500).json({ message: "Internal server error" });
};
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const VANITY_RE = /^[A-Za-z0-9\-_%.]{2,100}$/;

/** POST /ext/hello — the extension reports the LinkedIn account it sees; gets settings back. */
export const hello = async (req: ExtRequest, res: Response) => {
  try {
    const { tenantId, userId } = req.ext!;
    const b = req.body ?? {};
    await pool.query(
      `INSERT INTO linkedin_accounts (tenant_id, user_id, li_name, li_public_id, li_headline, has_premium, recruiter_lite_detected, ext_version, last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET
         li_name = COALESCE(EXCLUDED.li_name, linkedin_accounts.li_name),
         li_public_id = COALESCE(EXCLUDED.li_public_id, linkedin_accounts.li_public_id),
         li_headline = COALESCE(EXCLUDED.li_headline, linkedin_accounts.li_headline),
         has_premium = EXCLUDED.has_premium,
         recruiter_lite_detected = EXCLUDED.recruiter_lite_detected,
         ext_version = EXCLUDED.ext_version,
         last_seen_at = now()`,
      [tenantId, userId, str(b.name, 120), str(b.publicId, 100), str(b.headline, 220), b.premium === true, b.recruiterLite === true, str(b.version, 20)],
    );
    res.json(await getAccount(tenantId, userId));
  } catch (err) { fail(res, "hello", err); }
};

/** GET /ext/work — what the extension should do now: searches to run and whether invites may go out. */
export const getWork = async (req: ExtRequest, res: Response) => {
  try {
    const { tenantId, userId } = req.ext!;
    await pool.query(`UPDATE linkedin_accounts SET last_seen_at = now() WHERE tenant_id = $1 AND user_id = $2`, [tenantId, userId]);
    const acct = await getAccount(tenantId, userId);
    const campaigns = await pool.query(
      `SELECT c.id, c.name, c.status, c.channel, c.search, c.recruiter_search, c.max_pages, c.search_requested_at, c.last_search_at,
              (SELECT COUNT(*)::int FROM linkedin_prospects p WHERE p.campaign_id = c.id AND p.status IN ('new','scored','approved')) AS backlog,
              c.daily_invite_limit
         FROM linkedin_campaigns c
        WHERE c.tenant_id = $1 AND c.owner_user_id = $2 AND c.status IN ('draft','active')
        ORDER BY c.updated_at DESC`,
      [tenantId, userId],
    );
    const searches = campaigns.rows
      .filter((c) => c.channel === "linkedin")
      .filter((c) => {
        const requested = c.search_requested_at && (!c.last_search_at || new Date(c.search_requested_at) > new Date(c.last_search_at));
        // Active campaigns top themselves up once a day when the review/sending backlog runs low.
        const refill = c.status === "active" && c.backlog < c.daily_invite_limit * 2 &&
          (!c.last_search_at || Date.now() - new Date(c.last_search_at).getTime() > 20 * 3600 * 1000);
        return requested || refill;
      })
      .map((c) => {
        const search = normalizeFilters(c.search);
        const built = buildPeopleSearchUrl(search);
        return { campaign_id: c.id, name: c.name, url: built.url, unresolved: built.unresolved, max_pages: c.max_pages };
      });
    const paused = !!acct.linkedin?.paused_until;
    const capLeft = Math.max(0, Math.min(WEEKLY_INVITE_CAP - acct.limits.sent_this_week, DAILY_INVITE_CAP_PER_USER - acct.limits.sent_today));
    const ready = await pool.query(
      `SELECT COUNT(*)::int AS n FROM linkedin_prospects p JOIN linkedin_campaigns c ON c.id = p.campaign_id
        WHERE c.tenant_id = $1 AND c.owner_user_id = $2 AND c.status = 'active' AND c.channel = 'linkedin'
          AND p.public_id IS NOT NULL AND (p.status = 'approved' OR (p.status = 'queued' AND p.lease_until < now()))`,
      [tenantId, userId],
    );
    res.json({
      paused,
      paused_reason: acct.linkedin?.paused_reason ?? null,
      searches: paused ? [] : searches,
      invites_ready: paused ? 0 : Math.min(capLeft, ready.rows[0].n),
      limits: acct.limits,
      campaigns: campaigns.rows.map((c) => ({ id: c.id, name: c.name, status: c.status, channel: c.channel })),
      recruiter_searches: campaigns.rows
        .filter((c) => c.channel === "recruiter_lite" && c.recruiter_search)
        .map((c) => ({ campaign_id: c.id, name: c.name, ...RecruiterSearchSchema.parse(c.recruiter_search) })),
    });
  } catch (err) { fail(res, "getWork", err); }
};

async function ownCampaign(req: ExtRequest, id: string) {
  if (!UUID_RE.test(id)) return null;
  const r = await pool.query(
    `SELECT * FROM linkedin_campaigns WHERE id = $1 AND tenant_id = $2 AND owner_user_id = $3`,
    [id, req.ext!.tenantId, req.ext!.userId],
  );
  return r.rows[0] ?? null;
}

/** POST /ext/campaigns/:id/resolved { resolved: { locations: { "Hyderabad": "105556991" }, ... } } */
export const saveResolved = async (req: ExtRequest, res: Response) => {
  try {
    const c = await ownCampaign(req, String(req.params.id));
    if (!c) return res.status(404).json({ message: "Campaign not found" });
    const search = normalizeFilters(c.search);
    const incoming = req.body?.resolved ?? {};
    for (const key of RESOLVABLE) {
      const map = incoming[key];
      if (!map || typeof map !== "object") continue;
      for (const [name, id] of Object.entries(map)) {
        if (search[key].includes(name) && typeof id === "string" && /^\d{1,20}$/.test(id)) search.resolved[key][name] = id;
      }
    }
    await pool.query(`UPDATE linkedin_campaigns SET search = $2 WHERE id = $1`, [c.id, JSON.stringify(search)]);
    res.json(buildPeopleSearchUrl(search));
  } catch (err) { fail(res, "saveResolved", err); }
};

interface IncomingProspect {
  publicId?: string; recruiterId?: string; profileUrl?: string; recruiterUrl?: string;
  name?: string; headline?: string; location?: string; degree?: string; snippet?: string;
}

/** POST /ext/campaigns/:id/prospects { source: search|page|recruiter, prospects: [...], searchDone?: bool, error?: string } */
export const importProspects = async (req: ExtRequest, res: Response) => {
  try {
    const { tenantId, userId } = req.ext!;
    const c = await ownCampaign(req, String(req.params.id));
    if (!c) return res.status(404).json({ message: "Campaign not found" });
    const list: IncomingProspect[] = Array.isArray(req.body?.prospects) ? req.body.prospects.slice(0, 200) : [];
    let added = 0, duplicates = 0, contacted = 0, connected = 0;

    for (const p of list) {
      const publicId = str(p.publicId, 100);
      const recruiterId = str(p.recruiterId, 100);
      if (publicId && !VANITY_RE.test(publicId)) continue;
      const key = publicId ? publicId.toLowerCase() : recruiterId ? `recruiter:${recruiterId}` : null;
      if (!key) continue;
      const degree = str(p.degree, 10);
      let status = "new";
      let error: string | null = null;
      if (degree && /^1/.test(degree)) { status = "already_connected"; connected++; }
      else if (publicId) {
        // Never invite the same person twice from this company, whichever campaign found them.
        const prior = await pool.query(
          `SELECT 1 FROM linkedin_prospects WHERE tenant_id = $1 AND lower(public_id) = lower($2) AND status IN ('sent','accepted','queued') LIMIT 1`,
          [tenantId, publicId],
        );
        if (prior.rows.length) { status = "skipped"; error = "Already invited from another campaign"; contacted++; }
      }
      const profileUrl = publicId ? `https://www.linkedin.com/in/${publicId}/` : null;
      const recruiterUrl = str(p.recruiterUrl, 500);
      const ins = await pool.query(
        `INSERT INTO linkedin_prospects (tenant_id, campaign_id, profile_key, public_id, profile_url, recruiter_url, full_name, headline, location, degree, snippet, status, error)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (campaign_id, profile_key) DO NOTHING RETURNING id`,
        [tenantId, c.id, key, publicId, profileUrl, recruiterUrl && /^https:\/\/www\.linkedin\.com\//.test(recruiterUrl) ? recruiterUrl : null,
         str(p.name, 150), str(p.headline, 300), str(p.location, 150), degree, str(p.snippet, 600), status, error],
      );
      if (ins.rowCount) added++; else duplicates++;
    }
    if (req.body?.searchDone) await pool.query(`UPDATE linkedin_campaigns SET last_search_at = now() WHERE id = $1`, [c.id]);
    await logAction({ tenantId, userId, kind: "import", campaignId: c.id, detail: `${req.body?.source ?? "page"}: ${added} new, ${duplicates} duplicate${req.body?.error ? `; ${String(req.body.error).slice(0, 200)}` : ""}` });
    void processNewProspects(5);
    res.json({ added, duplicates, already_contacted: contacted, already_connected: connected });
  } catch (err) { fail(res, "importProspects", err); }
};

/** POST /ext/next-invite — leases the next approved prospect, honouring every limit. 204 = nothing to send. */
export const nextInvite = async (req: ExtRequest, res: Response) => {
  try {
    const { tenantId, userId } = req.ext!;
    const acct = await getAccount(tenantId, userId);
    if (acct.linkedin?.paused_until) return res.status(204).end();
    const counts = await inviteCounts(tenantId, userId);
    if (counts.week >= WEEKLY_INVITE_CAP || counts.today >= DAILY_INVITE_CAP_PER_USER) return res.status(204).end();

    const r = await pool.query(
      `WITH today AS (
         SELECT campaign_id, COUNT(*) AS n FROM linkedin_actions
          WHERE tenant_id = $1 AND user_id = $2 AND kind = 'invite_sent'
            AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
          GROUP BY campaign_id)
       UPDATE linkedin_prospects p SET status = 'queued', lease_until = now() + interval '10 minutes', updated_at = now()
        WHERE p.id = (
          SELECT p2.id FROM linkedin_prospects p2
            JOIN linkedin_campaigns c ON c.id = p2.campaign_id
            LEFT JOIN today t ON t.campaign_id = c.id
           WHERE c.tenant_id = $1 AND c.owner_user_id = $2 AND c.status = 'active' AND c.channel = 'linkedin'
             AND p2.public_id IS NOT NULL
             AND (p2.status = 'approved' OR (p2.status = 'queued' AND p2.lease_until < now()))
             AND COALESCE(t.n, 0) < c.daily_invite_limit
           ORDER BY p2.match_score DESC NULLS LAST, p2.created_at
           LIMIT 1 FOR UPDATE OF p2 SKIP LOCKED)
       RETURNING p.id, p.campaign_id, p.public_id, p.full_name, p.note,
                 (SELECT use_notes FROM linkedin_campaigns WHERE id = p.campaign_id) AS use_notes`,
      [tenantId, userId],
    );
    const p = r.rows[0];
    if (!p) return res.status(204).end();
    res.json({ prospect_id: p.id, campaign_id: p.campaign_id, public_id: p.public_id, full_name: p.full_name, note: p.use_notes ? p.note : null });
  } catch (err) { fail(res, "nextInvite", err); }
};

const OUTCOMES: Record<string, string> = {
  sent: "sent",
  already_pending: "sent",
  needs_email: "needs_email",
  already_connected: "already_connected",
  failed: "failed",
  limit_reached: "approved",
  note_quota: "approved",
};

/** POST /ext/prospects/:id/result { outcome, error? } */
export const inviteResult = async (req: ExtRequest, res: Response) => {
  try {
    const { tenantId, userId } = req.ext!;
    const id = String(req.params.id);
    const outcome = String(req.body?.outcome ?? "");
    const status = OUTCOMES[outcome];
    if (!UUID_RE.test(id) || !status) return res.status(400).json({ message: "Unknown prospect or outcome" });
    const r = await pool.query(
      `UPDATE linkedin_prospects p SET status = $3, error = $4, lease_until = NULL,
              sent_at = CASE WHEN $3 = 'sent' THEN now() ELSE sent_at END, updated_at = now()
         FROM linkedin_campaigns c
        WHERE p.id = $1 AND p.tenant_id = $2 AND c.id = p.campaign_id AND c.owner_user_id = $5
        RETURNING p.id, p.campaign_id`,
      [id, tenantId, status, str(req.body?.error, 300), userId],
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ message: "Prospect not found" });
    if (outcome === "sent") await logAction({ tenantId, userId, kind: "invite_sent", campaignId: row.campaign_id, prospectId: id });
    if (outcome === "note_quota") {
      // Free LinkedIn accounts get only a few personalised notes a month: keep going without notes.
      await pool.query(`UPDATE linkedin_campaigns SET use_notes = false, updated_at = now() WHERE id = $1`, [row.campaign_id]);
      await logAction({ tenantId, userId, kind: "note_quota", campaignId: row.campaign_id, detail: "LinkedIn's monthly note limit reached; sending without notes" });
    }
    if (outcome === "limit_reached") await pauseAccount(tenantId, userId, "LinkedIn's weekly invitation limit was reached", 72);
    res.json({ ok: true });
  } catch (err) { fail(res, "inviteResult", err); }
};

async function pauseAccount(tenantId: string, userId: string, reason: string, hours: number) {
  await pool.query(
    `UPDATE linkedin_accounts SET paused_reason = $3, paused_until = now() + make_interval(hours => $4) WHERE tenant_id = $1 AND user_id = $2`,
    [tenantId, userId, reason, hours],
  );
  await pool.query(
    `UPDATE linkedin_prospects p SET status = 'approved', lease_until = NULL FROM linkedin_campaigns c
      WHERE c.id = p.campaign_id AND c.tenant_id = $1 AND c.owner_user_id = $2 AND p.status = 'queued'`,
    [tenantId, userId],
  );
  await logAction({ tenantId, userId, kind: "paused", detail: reason });
}

/** POST /ext/warning { kind: search_paused|restricted|captcha|limit_reached, detail? } — LinkedIn pushed back: stop. */
export const reportWarning = async (req: ExtRequest, res: Response) => {
  try {
    const { tenantId, userId } = req.ext!;
    const kind = String(req.body?.kind ?? "");
    const reasons: Record<string, [string, number]> = {
      search_paused: ["LinkedIn paused search activity on this account", 24],
      captcha: ["LinkedIn asked for a security check", 24],
      restricted: ["LinkedIn showed an account restriction warning", 168],
      limit_reached: ["LinkedIn's weekly invitation limit was reached", 72],
    };
    const r = reasons[kind];
    if (!r) return res.status(400).json({ message: "Unknown warning" });
    await pauseAccount(tenantId, userId, r[0], r[1]);
    res.json({ paused: true });
  } catch (err) { fail(res, "reportWarning", err); }
};

/** POST /ext/acceptances { publicIds: [...] } — recently added connections; marks accepted invites. */
export const reportAcceptances = async (req: ExtRequest, res: Response) => {
  try {
    const { tenantId, userId } = req.ext!;
    const list: string[] = Array.isArray(req.body?.publicIds)
      ? req.body.publicIds.filter((x: unknown) => typeof x === "string" && VANITY_RE.test(x)).map((x: string) => x.toLowerCase()).slice(0, 500)
      : [];
    if (!list.length) return res.json({ accepted: 0 });
    const r = await pool.query(
      `UPDATE linkedin_prospects p SET status = 'accepted', accepted_at = now(), updated_at = now()
         FROM linkedin_campaigns c
        WHERE c.id = p.campaign_id AND c.tenant_id = $1 AND c.owner_user_id = $2
          AND p.status = 'sent' AND lower(p.public_id) = ANY($3::text[])
        RETURNING p.*, c.job_id`,
      [tenantId, userId, list],
    );
    // Accepted connections become ZorHire candidates (and join the job's pipeline as "sourced").
    for (const p of r.rows) {
      try { await createCandidateFromProspect(tenantId, userId, p); } catch (e) { console.error("accepted -> candidate failed:", e); }
      await logAction({ tenantId, userId, kind: "invite_accepted", campaignId: p.campaign_id, prospectId: p.id });
    }
    res.json({ accepted: r.rowCount });
  } catch (err) { fail(res, "reportAcceptances", err); }
};

/** GET /ext/sent-public-ids — public ids still awaiting acceptance, so the extension knows whom to look for. */
export const pendingSent = async (req: ExtRequest, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT p.public_id FROM linkedin_prospects p JOIN linkedin_campaigns c ON c.id = p.campaign_id
        WHERE c.tenant_id = $1 AND c.owner_user_id = $2 AND p.status = 'sent' AND p.sent_at > now() - interval '60 days'`,
      [req.ext!.tenantId, req.ext!.userId],
    );
    res.json(r.rows.map((x) => x.public_id));
  } catch (err) { fail(res, "pendingSent", err); }
};
