import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";
import { buildSearchForJob, fallbackSearch, processNewProspects, regenerateNote } from "./linkedinAi";
import { buildPeopleSearchUrl, fitNote, noteLimit, normalizeFilters, RecruiterSearchSchema } from "./linkedinSearch";
import { getAccount, hashToken, inviteCounts, logAction, newToken, UUID_RE } from "./linkedinStore";

/**
 * Recruiter-facing LinkedIn agent API (/v1/linkedin-agent/*). Campaigns belong to the
 * recruiter who created them: invites go out from that recruiter's own LinkedIn account
 * through their extension, so other users can view but not run someone else's campaign.
 */

const fail = (res: Response, where: string, err: unknown) => {
  console.error(`linkedin-agent ${where} error:`, err);
  res.status(500).json({ message: "Internal server error" });
};
const ids = (req: AuthRequest) => ({ tenantId: req.user!.tenant_id, userId: req.user!.id });

/* ───────────── Connection (extension token) and account ───────────── */

export const getAccountStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, userId } = ids(req);
    res.json(await getAccount(tenantId, userId));
  } catch (err) { fail(res, "getAccountStatus", err); }
};

/** POST /connect — issues a connection code for the extension. Shown once; only its hash is stored. */
export const createConnectionCode = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, userId } = ids(req);
    const label = typeof req.body?.label === "string" ? req.body.label.slice(0, 60) : "Chrome";
    const open = await pool.query(`SELECT COUNT(*)::int AS n FROM linkedin_ext_tokens WHERE tenant_id=$1 AND user_id=$2 AND revoked_at IS NULL`, [tenantId, userId]);
    if (open.rows[0].n >= 5) return res.status(400).json({ message: "You already have 5 connected browsers. Remove one first." });
    const token = newToken();
    await pool.query(`INSERT INTO linkedin_ext_tokens (tenant_id, user_id, token_hash, label) VALUES ($1,$2,$3,$4)`, [tenantId, userId, hashToken(token), label]);
    res.status(201).json({ code: token });
  } catch (err) { fail(res, "createConnectionCode", err); }
};

export const revokeConnection = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, userId } = ids(req);
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) return res.status(404).json({ message: "Not found" });
    await pool.query(`UPDATE linkedin_ext_tokens SET revoked_at = now() WHERE id = $1 AND tenant_id = $2 AND user_id = $3`, [id, tenantId, userId]);
    res.json({ ok: true });
  } catch (err) { fail(res, "revokeConnection", err); }
};

/** PUT /account — the user's own Recruiter Lite choice (null = use detection) and resume after a pause. */
export const updateAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, userId } = ids(req);
    const v = req.body?.recruiter_lite_override;
    const override = v === true || v === false ? v : null;
    await pool.query(
      `INSERT INTO linkedin_accounts (tenant_id, user_id, recruiter_lite_override) VALUES ($1,$2,$3)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET recruiter_lite_override = EXCLUDED.recruiter_lite_override`,
      [tenantId, userId, override],
    );
    if (req.body?.resume === true) {
      await pool.query(`UPDATE linkedin_accounts SET paused_until = NULL, paused_reason = NULL WHERE tenant_id=$1 AND user_id=$2`, [tenantId, userId]);
    }
    res.json(await getAccount(tenantId, userId));
  } catch (err) { fail(res, "updateAccount", err); }
};

/* ───────────────────────────── Campaigns ───────────────────────────── */

const CAMPAIGN_COLS = `c.id, c.name, c.status, c.channel, c.job_id, j.title AS job_title, c.owner_user_id,
  NULLIF(TRIM(pr.full_name),'') AS owner_name, c.search, c.recruiter_search, c.note_instructions, c.use_notes,
  c.daily_invite_limit, c.auto_send, c.min_score, c.max_pages, c.search_requested_at, c.last_search_at,
  c.created_at, c.updated_at`;

async function stats(campaignIds: string[]) {
  if (!campaignIds.length) return new Map<string, Record<string, number>>();
  const r = await pool.query(
    `SELECT campaign_id, status, COUNT(*)::int AS n FROM linkedin_prospects WHERE campaign_id = ANY($1::uuid[]) GROUP BY campaign_id, status`,
    [campaignIds],
  );
  const today = await pool.query(
    `SELECT campaign_id, COUNT(*)::int AS n FROM linkedin_actions
      WHERE campaign_id = ANY($1::uuid[]) AND kind = 'invite_sent'
        AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
      GROUP BY campaign_id`,
    [campaignIds],
  );
  const m = new Map<string, Record<string, number>>();
  for (const row of r.rows) {
    const s = m.get(row.campaign_id) ?? {};
    s[row.status] = row.n;
    s.total = (s.total ?? 0) + row.n;
    m.set(row.campaign_id, s);
  }
  for (const row of today.rows) {
    const s = m.get(row.campaign_id) ?? {};
    s.sent_today = row.n;
    m.set(row.campaign_id, s);
  }
  return m;
}

function present(row: any, s?: Record<string, number>) {
  const search = normalizeFilters(row.search);
  const built = buildPeopleSearchUrl(search);
  return {
    ...row,
    search,
    recruiter_search: row.recruiter_search ? RecruiterSearchSchema.parse(row.recruiter_search) : null,
    search_url: built.url,
    unresolved: built.unresolved,
    stats: {
      total: s?.total ?? 0,
      to_review: s?.scored ?? 0,
      new: s?.new ?? 0,
      approved: (s?.approved ?? 0) + (s?.queued ?? 0),
      sent: (s?.sent ?? 0) + (s?.accepted ?? 0),
      accepted: s?.accepted ?? 0,
      skipped: (s?.skipped ?? 0) + (s?.already_connected ?? 0) + (s?.needs_email ?? 0),
      failed: s?.failed ?? 0,
      sent_today: s?.sent_today ?? 0,
    },
  };
}

async function loadCampaign(tenantId: string, id: string) {
  if (!UUID_RE.test(id)) return null;
  const r = await pool.query(
    `SELECT ${CAMPAIGN_COLS} FROM linkedin_campaigns c
       LEFT JOIN jobs j ON j.id = c.job_id
       LEFT JOIN profiles pr ON pr.id = c.owner_user_id
      WHERE c.id = $1 AND c.tenant_id = $2`,
    [id, tenantId],
  );
  return r.rows[0] ?? null;
}

export const listCampaigns = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, userId } = ids(req);
    const mine = req.query.scope !== "all";
    const r = await pool.query(
      `SELECT ${CAMPAIGN_COLS} FROM linkedin_campaigns c
         LEFT JOIN jobs j ON j.id = c.job_id
         LEFT JOIN profiles pr ON pr.id = c.owner_user_id
        WHERE c.tenant_id = $1 AND ($2::uuid IS NULL OR c.owner_user_id = $2)
        ORDER BY (c.status = 'active') DESC, c.updated_at DESC LIMIT 200`,
      [tenantId, mine ? userId : null],
    );
    const s = await stats(r.rows.map((x) => x.id));
    res.json(r.rows.map((x) => present(x, s.get(x.id))));
  } catch (err) { fail(res, "listCampaigns", err); }
};

export const getCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const c = await loadCampaign(req.user!.tenant_id, String(req.params.id));
    if (!c) return res.status(404).json({ message: "Campaign not found" });
    const s = await stats([c.id]);
    res.json(present(c, s.get(c.id)));
  } catch (err) { fail(res, "getCampaign", err); }
};

function readSettings(body: any) {
  const out: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) out.name = body.name.trim().slice(0, 120);
  if (body.channel === "linkedin" || body.channel === "recruiter_lite") out.channel = body.channel;
  if (body.search !== undefined) out.search = normalizeFilters(body.search);
  if (body.recruiter_search !== undefined) {
    const p = RecruiterSearchSchema.safeParse(body.recruiter_search);
    if (p.success) out.recruiter_search = p.data;
  }
  if (typeof body.note_instructions === "string" || body.note_instructions === null) out.note_instructions = body.note_instructions?.slice(0, 1000) ?? null;
  if (typeof body.use_notes === "boolean") out.use_notes = body.use_notes;
  if (typeof body.auto_send === "boolean") out.auto_send = body.auto_send;
  const int = (v: unknown, lo: number, hi: number) => (Number.isInteger(v) ? Math.min(hi, Math.max(lo, v as number)) : undefined);
  const d = int(body.daily_invite_limit, 1, 40); if (d !== undefined) out.daily_invite_limit = d;
  const m = int(body.min_score, 0, 100); if (m !== undefined) out.min_score = m;
  const p = int(body.max_pages, 1, 10); if (p !== undefined) out.max_pages = p;
  return out;
}

async function jobForTenant(tenantId: string, jobId: unknown) {
  if (typeof jobId !== "string" || !UUID_RE.test(jobId)) return null;
  const r = await pool.query(
    `SELECT id, title, description, mandatory_skills, preferred_skills, experience_min, experience_max, location, work_mode
       FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [jobId, tenantId],
  );
  return r.rows[0] ?? null;
}

/** POST /campaigns { name?, job_id?, generate?: boolean, ...settings } */
export const createCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, userId } = ids(req);
    const body = req.body ?? {};
    const job = body.job_id ? await jobForTenant(tenantId, body.job_id) : null;
    if (body.job_id && !job) return res.status(404).json({ message: "Job not found" });
    const s = readSettings(body);
    const name = (s.name as string) ?? (job ? `${job.title} – LinkedIn` : null);
    if (!name) return res.status(400).json({ message: "Give the campaign a name or pick a job." });

    const ins = await pool.query(
      `INSERT INTO linkedin_campaigns (tenant_id, owner_user_id, job_id, name, channel, search, recruiter_search, note_instructions,
                                       use_notes, daily_invite_limit, auto_send, min_score, max_pages)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,true),COALESCE($10,15),COALESCE($11,false),COALESCE($12,60),COALESCE($13,3))
       RETURNING id`,
      [tenantId, userId, job?.id ?? null, name, s.channel ?? "linkedin", JSON.stringify(s.search ?? normalizeFilters({})),
       s.recruiter_search ? JSON.stringify(s.recruiter_search) : null, s.note_instructions ?? null,
       s.use_notes ?? null, s.daily_invite_limit ?? null, s.auto_send ?? null, s.min_score ?? null, s.max_pages ?? null],
    );
    const id = ins.rows[0].id;
    let rationale: string | null = null;
    if (job && body.generate !== false && body.search === undefined) {
      const built = await buildSearchForJob(tenantId, id, job);
      rationale = built.rationale;
      await pool.query(`UPDATE linkedin_campaigns SET search = $2, recruiter_search = $3 WHERE id = $1`, [id, JSON.stringify(built.linkedin), JSON.stringify(built.recruiter)]);
    }
    await logAction({ tenantId, userId, kind: "campaign_created", campaignId: id, detail: name });
    const c = await loadCampaign(tenantId, id);
    res.status(201).json({ ...present(c), rationale });
  } catch (err) { fail(res, "createCampaign", err); }
};

/** POST /campaigns/:id/generate-search — rebuild filters from the job with AI. */
export const generateSearch = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = ids(req);
    const c = await loadCampaign(tenantId, String(req.params.id));
    if (!c) return res.status(404).json({ message: "Campaign not found" });
    const job = c.job_id ? await jobForTenant(tenantId, c.job_id) : null;
    if (!job && !req.body?.title) return res.status(400).json({ message: "Link the campaign to a job (or send a title) to generate a search." });
    const built = job ? await buildSearchForJob(tenantId, c.id, job) : { ...fallbackSearch({ title: String(req.body.title) }), ai: false };
    // Keep ids LinkedIn already resolved for names that are still in the new search.
    const prev = normalizeFilters(c.search);
    built.linkedin.resolved = prev.resolved;
    await pool.query(`UPDATE linkedin_campaigns SET search = $2, recruiter_search = $3, updated_at = now() WHERE id = $1`, [c.id, JSON.stringify(built.linkedin), JSON.stringify(built.recruiter)]);
    res.json({ search: built.linkedin, recruiter_search: built.recruiter, rationale: built.rationale, ai: built.ai, ...buildPeopleSearchUrl(built.linkedin) });
  } catch (err) { fail(res, "generateSearch", err); }
};

export const updateCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, userId } = ids(req);
    const c = await loadCampaign(tenantId, String(req.params.id));
    if (!c) return res.status(404).json({ message: "Campaign not found" });
    if (c.owner_user_id !== userId) return res.status(403).json({ message: "Only the recruiter who owns this campaign can change it." });
    const s = readSettings(req.body ?? {});
    if (s.search) {
      // Preserve resolved LinkedIn ids for names the recruiter kept.
      const prev = normalizeFilters(c.search).resolved;
      const next = s.search as ReturnType<typeof normalizeFilters>;
      for (const k of Object.keys(prev) as (keyof typeof prev)[]) next.resolved[k] = { ...prev[k], ...next.resolved[k] };
    }
    const keys = Object.keys(s);
    if (keys.length) {
      const sets = keys.map((k, i) => `${k} = $${i + 2}${k === "search" || k === "recruiter_search" ? "::jsonb" : ""}`);
      const vals = keys.map((k) => (k === "search" || k === "recruiter_search" ? JSON.stringify(s[k]) : s[k]));
      await pool.query(`UPDATE linkedin_campaigns SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, [c.id, ...vals]);
    }
    const fresh = await loadCampaign(tenantId, c.id);
    const st = await stats([c.id]);
    res.json(present(fresh, st.get(c.id)));
  } catch (err) { fail(res, "updateCampaign", err); }
};

/** POST /campaigns/:id/status { status: active|paused|completed } */
export const setCampaignStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, userId } = ids(req);
    const status = String(req.body?.status ?? "");
    if (!["active", "paused", "completed"].includes(status)) return res.status(400).json({ message: "status must be active, paused or completed" });
    const c = await loadCampaign(tenantId, String(req.params.id));
    if (!c) return res.status(404).json({ message: "Campaign not found" });
    if (c.owner_user_id !== userId) return res.status(403).json({ message: "Only the recruiter who owns this campaign can run it." });
    await pool.query(
      `UPDATE linkedin_campaigns SET status = $2, updated_at = now(),
              search_requested_at = CASE WHEN $2 = 'active' AND last_search_at IS NULL THEN now() ELSE search_requested_at END
        WHERE id = $1`,
      [c.id, status],
    );
    // Release prospects a paused/finished campaign had queued.
    if (status !== "active") await pool.query(`UPDATE linkedin_prospects SET status = 'approved', lease_until = NULL WHERE campaign_id = $1 AND status = 'queued'`, [c.id]);
    await logAction({ tenantId, userId, kind: `campaign_${status}`, campaignId: c.id });
    res.json({ ok: true, status });
  } catch (err) { fail(res, "setCampaignStatus", err); }
};

/** POST /campaigns/:id/run-search — ask the extension to run the search on its next check-in. */
export const requestSearch = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, userId } = ids(req);
    const c = await loadCampaign(tenantId, String(req.params.id));
    if (!c) return res.status(404).json({ message: "Campaign not found" });
    if (c.owner_user_id !== userId) return res.status(403).json({ message: "Only the campaign owner's extension can run its search." });
    await pool.query(`UPDATE linkedin_campaigns SET search_requested_at = now(), updated_at = now() WHERE id = $1`, [c.id]);
    res.json({ ok: true });
  } catch (err) { fail(res, "requestSearch", err); }
};

export const deleteCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, userId } = ids(req);
    const c = await loadCampaign(tenantId, String(req.params.id));
    if (!c) return res.status(404).json({ message: "Campaign not found" });
    if (c.owner_user_id !== userId && req.user!.role !== "super_admin") return res.status(403).json({ message: "Only the owner can delete this campaign." });
    await pool.query(`DELETE FROM linkedin_campaigns WHERE id = $1`, [c.id]);
    res.json({ ok: true });
  } catch (err) { fail(res, "deleteCampaign", err); }
};

/* ───────────────────────────── Prospects ───────────────────────────── */

const PROSPECT_STATUSES = ["new", "scored", "approved", "queued", "sent", "accepted", "skipped", "failed", "needs_email", "already_connected"];

export const listProspects = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = ids(req);
    const c = await loadCampaign(tenantId, String(req.params.id));
    if (!c) return res.status(404).json({ message: "Campaign not found" });
    const status = typeof req.query.status === "string" ? req.query.status.split(",").filter((s) => PROSPECT_STATUSES.includes(s)) : [];
    const r = await pool.query(
      `SELECT id, profile_key, public_id, profile_url, recruiter_url, full_name, headline, location, degree, snippet,
              match_score, match_reasons, note, inmail_subject, note_edited, status, error, sent_at, accepted_at, candidate_id, created_at
         FROM linkedin_prospects
        WHERE campaign_id = $1 AND ($2::text[] IS NULL OR status = ANY($2::text[]))
        ORDER BY CASE status WHEN 'scored' THEN 0 WHEN 'new' THEN 1 WHEN 'approved' THEN 2 WHEN 'queued' THEN 3 ELSE 4 END,
                 match_score DESC NULLS LAST, created_at DESC
        LIMIT 500`,
      [c.id, status.length ? status : null],
    );
    res.json(r.rows);
  } catch (err) { fail(res, "listProspects", err); }
};

async function prospectForOwner(req: AuthRequest, id: string) {
  if (!UUID_RE.test(id)) return null;
  const r = await pool.query(
    `SELECT p.*, c.owner_user_id, c.job_id, a.has_premium FROM linkedin_prospects p
       JOIN linkedin_campaigns c ON c.id = p.campaign_id
       LEFT JOIN linkedin_accounts a ON a.tenant_id = c.tenant_id AND a.user_id = c.owner_user_id
      WHERE p.id = $1 AND p.tenant_id = $2`,
    [id, req.user!.tenant_id],
  );
  return r.rows[0] ?? null;
}

/** PATCH /prospects/:id { note?, inmail_subject?, action?: approve|skip|unskip } */
export const updateProspect = async (req: AuthRequest, res: Response) => {
  try {
    const p = await prospectForOwner(req, String(req.params.id));
    if (!p) return res.status(404).json({ message: "Prospect not found" });
    if (p.owner_user_id !== req.user!.id) return res.status(403).json({ message: "Only the campaign owner can change prospects." });
    const body = req.body ?? {};
    if (typeof body.note === "string") {
      const limit = noteLimit(!!p.has_premium);
      if (body.note.trim().length > limit) return res.status(400).json({ message: `Notes can be at most ${limit} characters on this LinkedIn account.` });
      await pool.query(`UPDATE linkedin_prospects SET note = $2, note_edited = true, updated_at = now() WHERE id = $1`, [p.id, fitNote(body.note, limit)]);
    }
    if (typeof body.inmail_subject === "string") {
      await pool.query(`UPDATE linkedin_prospects SET inmail_subject = $2, updated_at = now() WHERE id = $1`, [p.id, body.inmail_subject.slice(0, 120)]);
    }
    if (body.action) {
      const next = applyAction(String(body.action), p.status);
      if (!next) return res.status(400).json({ message: `Can't ${body.action} a prospect that is ${p.status.replace("_", " ")}.` });
      await pool.query(`UPDATE linkedin_prospects SET status = $2, lease_until = NULL, error = NULL, updated_at = now() WHERE id = $1`, [p.id, next]);
    }
    const r = await pool.query(`SELECT * FROM linkedin_prospects WHERE id = $1`, [p.id]);
    res.json(r.rows[0]);
  } catch (err) { fail(res, "updateProspect", err); }
};

function applyAction(action: string, status: string): string | null {
  if (action === "approve" && ["scored", "new", "skipped", "failed"].includes(status)) return "approved";
  if (action === "skip" && ["scored", "new", "approved", "queued", "failed"].includes(status)) return "skipped";
  if (action === "unskip" && status === "skipped") return "scored";
  return null;
}

/** POST /campaigns/:id/prospects/bulk { ids: [], action: approve|skip } or { all_above: score, action } */
export const bulkProspects = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, userId } = ids(req);
    const c = await loadCampaign(tenantId, String(req.params.id));
    if (!c) return res.status(404).json({ message: "Campaign not found" });
    if (c.owner_user_id !== userId) return res.status(403).json({ message: "Only the campaign owner can change prospects." });
    const action = String(req.body?.action ?? "");
    if (action !== "approve" && action !== "skip") return res.status(400).json({ message: "action must be approve or skip" });
    const from = action === "approve" ? ["scored", "new", "failed"] : ["scored", "new", "approved", "queued", "failed"];
    const list: string[] = Array.isArray(req.body?.ids) ? req.body.ids.filter((x: unknown) => typeof x === "string" && UUID_RE.test(x)).slice(0, 500) : [];
    const above = Number.isInteger(req.body?.all_above) ? Number(req.body.all_above) : null;
    if (!list.length && above === null) return res.status(400).json({ message: "Send ids or all_above" });
    const r = await pool.query(
      `UPDATE linkedin_prospects SET status = $2, lease_until = NULL, error = NULL, updated_at = now()
        WHERE campaign_id = $1 AND status = ANY($3::text[])
          AND (($4::uuid[] IS NOT NULL AND id = ANY($4::uuid[])) OR ($5::int IS NOT NULL AND match_score >= $5))
        RETURNING id`,
      [c.id, action === "approve" ? "approved" : "skipped", from, list.length ? list : null, above],
    );
    res.json({ updated: r.rowCount });
  } catch (err) { fail(res, "bulkProspects", err); }
};

export const regenerateProspectNote = async (req: AuthRequest, res: Response) => {
  try {
    const p = await prospectForOwner(req, String(req.params.id));
    if (!p) return res.status(404).json({ message: "Prospect not found" });
    if (p.owner_user_id !== req.user!.id) return res.status(403).json({ message: "Only the campaign owner can change prospects." });
    if (!["new", "scored", "approved", "failed", "skipped"].includes(p.status)) return res.status(400).json({ message: "This invitation has already gone out." });
    const out = await regenerateNote(req.user!.tenant_id, p.id);
    const r = await pool.query(`SELECT * FROM linkedin_prospects WHERE id = $1`, [p.id]);
    res.json({ ...r.rows[0], regenerated: !!out });
  } catch (err) { fail(res, "regenerateProspectNote", err); }
};

/** POST /prospects/:id/to-candidate — create a ZorHire candidate (and add to the job's pipeline). */
export const prospectToCandidate = async (req: AuthRequest, res: Response) => {
  try {
    const p = await prospectForOwner(req, String(req.params.id));
    if (!p) return res.status(404).json({ message: "Prospect not found" });
    const result = await createCandidateFromProspect(req.user!.tenant_id, req.user!.id, p);
    res.status(result.created ? 201 : 200).json(result);
  } catch (err) { fail(res, "prospectToCandidate", err); }
};

export async function createCandidateFromProspect(tenantId: string, userId: string, p: any) {
  if (p.candidate_id) return { candidate_id: p.candidate_id, created: false };
  const parts = String(p.full_name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = parts.shift() ?? "LinkedIn";
  const last = parts.join(" ") || "-";
  const headline: string = p.headline ?? "";
  const [title, company] = headline.split(/\s+(?:at|@)\s+/i);
  const url = p.profile_url ?? (p.public_id ? `https://www.linkedin.com/in/${p.public_id}/` : p.recruiter_url);
  const existing = url
    ? await pool.query(`SELECT id FROM candidates WHERE tenant_id = $1 AND linkedin_url = $2 AND deleted_at IS NULL LIMIT 1`, [tenantId, url])
    : { rows: [] as any[] };
  let candidateId: string = existing.rows[0]?.id;
  let created = false;
  if (!candidateId) {
    const ins = await pool.query(
      `INSERT INTO candidates (tenant_id, first_name, last_name, email, current_title, current_company, current_location, summary, source, linkedin_url, created_by)
       VALUES ($1,$2,$3,'',$4,$5,$6,$7,'linkedin',$8,$9) RETURNING id`,
      [tenantId, first.slice(0, 100), last.slice(0, 100), (title ?? headline).slice(0, 200) || null, company?.slice(0, 200) ?? null,
       p.location ?? null, [headline, p.snippet].filter(Boolean).join("\n\n").slice(0, 2000) || null, url, userId],
    );
    candidateId = ins.rows[0].id;
    created = true;
  }
  if (p.job_id) {
    await pool.query(
      `INSERT INTO job_applications (tenant_id, job_id, candidate_id, stage, notes, created_at, updated_at)
       SELECT $1, $2, $3, 'sourced', 'Sourced by the LinkedIn agent', now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM job_applications WHERE job_id = $2 AND candidate_id = $3)`,
      [tenantId, p.job_id, candidateId],
    );
  }
  await pool.query(`UPDATE linkedin_prospects SET candidate_id = $2, updated_at = now() WHERE id = $1`, [p.id, candidateId]);
  return { candidate_id: candidateId, created };
}

/* ───────────────────────────── Summary ───────────────────────────── */

export const getSummary = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, userId } = ids(req);
    const counts = await inviteCounts(tenantId, userId);
    const r = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE p.status IN ('sent','accepted'))::int AS sent,
              COUNT(*) FILTER (WHERE p.status = 'accepted')::int AS accepted,
              COUNT(*) FILTER (WHERE p.status = 'scored')::int AS to_review,
              COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'active')::int AS active_campaigns
         FROM linkedin_campaigns c LEFT JOIN linkedin_prospects p ON p.campaign_id = c.id
        WHERE c.tenant_id = $1 AND c.owner_user_id = $2`,
      [tenantId, userId],
    );
    void processNewProspects(2);
    res.json({ ...r.rows[0], sent_today: counts.today, sent_this_week: counts.week });
  } catch (err) { fail(res, "getSummary", err); }
};
