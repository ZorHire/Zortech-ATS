import crypto from "crypto";
import { Request, Response } from "express";
import pool from "../../db";
import env from "../../config/env";
import { applyAiStageMove } from "../pipeline/pipeline.controller";
import { esc, getAgentMailer, getSettings, outreachSentToday, recordEvent } from "./agentStore";

/**
 * Scheduler agent (no LLM): emails the candidate a link to pick one of the job's
 * interview slots, then books the interview when they choose. Slots already
 * taken by another candidate for the same job are hidden and refused.
 */

const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

async function takenSlots(jobId: string, excludeBookingId?: string): Promise<Set<string>> {
  const r = await pool.query(
    `SELECT b.chosen_slot FROM interview_bookings b
       JOIN job_applications ja ON ja.id = b.application_id
      WHERE ja.job_id = $1 AND b.status = 'booked' AND b.chosen_slot IS NOT NULL AND ($2::uuid IS NULL OR b.id <> $2)`,
    [jobId, excludeBookingId ?? null],
  );
  return new Set(r.rows.map((x: { chosen_slot: Date }) => new Date(x.chosen_slot).toISOString()));
}

export async function runScheduler(task: { tenantId: string; applicationId: string; manual?: boolean }): Promise<"done" | "skipped"> {
  const r = await pool.query(
    `SELECT ja.id, ja.job_id, c.first_name, c.last_name, c.email, j.title, t.name AS company
       FROM job_applications ja
       JOIN candidates c ON c.id = ja.candidate_id
       JOIN jobs j ON j.id = ja.job_id
       JOIN tenants t ON t.id = ja.tenant_id
      WHERE ja.id = $1 AND ja.tenant_id = $2`,
    [task.applicationId, task.tenantId],
  );
  const row = r.rows[0];
  if (!row) return "skipped";
  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Candidate";
  const skip = async (why: string) => {
    await recordEvent({ tenantId: task.tenantId, jobId: row.job_id, applicationId: row.id, agent: "scheduler", action: "skipped", summary: `Scheduling link for ${name} not sent: ${why}.` });
    return "skipped" as const;
  };

  const open = await pool.query(
    `SELECT 1 FROM interview_bookings WHERE application_id = $1 AND (status = 'booked' OR (status = 'sent' AND expires_at > now())) LIMIT 1`,
    [row.id],
  );
  if (open.rows.length) return "skipped";
  if (!row.email) return skip("no email address on file");

  const settings = await getSettings(task.tenantId, row.job_id);
  const taken = await takenSlots(row.job_id);
  const now = Date.now();
  const slots = settings.interview_slots.filter((s) => Date.parse(s) > now + 60 * 60 * 1000 && !taken.has(s));
  if (!slots.length) return skip("no free interview slots set on the job (add some in Autopilot settings)");

  if (!task.manual && (await outreachSentToday(task.tenantId, row.job_id)) >= settings.daily_outreach_cap) {
    throw new Error("daily outreach cap reached; retrying later");
  }
  const mail = await getAgentMailer(task.tenantId, row.job_id);
  if (!mail) return skip("no company mailbox or recruiter mailbox configured in Email Settings");

  const token = crypto.randomBytes(32).toString("hex");
  const lastSlot = Math.max(...slots.map((s) => Date.parse(s)));
  const expiresAt = new Date(Math.min(now + LINK_TTL_MS, lastSlot));
  await pool.query(
    `INSERT INTO interview_bookings (tenant_id, application_id, token_hash, slots, duration_min, expires_at)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6)`,
    [task.tenantId, row.id, hashToken(token), JSON.stringify(slots), settings.interview_duration_min, expiresAt],
  );
  const link = `${env.FRONTEND_URL}/schedule/${token}`;

  await mail.transporter.sendMail({
    from: mail.fromEmail,
    to: row.email,
    subject: `Pick a time for your ${row.title} interview`,
    html: `<p>Hi ${esc(row.first_name || "there")},</p>
<p>Good news: we'd like to move you to the interview stage for the <strong>${esc(row.title)}</strong> role with ${esc(row.company)}.</p>
<p>Please choose a ${settings.interview_duration_min}-minute slot that suits you:</p>
<p><a href="${link}">Choose an interview time</a></p>
<p>Slots are shown in your local time. The link is valid until ${expiresAt.toUTCString()}.</p>
<p>Regards,<br>${esc(row.company)} recruitment team</p>`,
  });

  await recordEvent({ tenantId: task.tenantId, jobId: row.job_id, applicationId: row.id, agent: "scheduler", action: "schedule_link_sent", summary: `Sent ${name} a link to pick from ${slots.length} interview slot${slots.length === 1 ? "" : "s"}.` });
  return "done";
}

async function findBooking(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const r = await pool.query(
    `SELECT b.*, ja.job_id, ja.stage, c.first_name, c.last_name, j.title, t.name AS company
       FROM interview_bookings b
       JOIN job_applications ja ON ja.id = b.application_id
       JOIN candidates c ON c.id = ja.candidate_id
       JOIN jobs j ON j.id = ja.job_id
       JOIN tenants t ON t.id = b.tenant_id
      WHERE b.token_hash = $1`,
    [hashToken(token)],
  );
  return r.rows[0] ?? null;
}

const statusOf = (b: { status: string; expires_at: Date }) =>
  b.status === "booked" ? "booked" : b.status !== "sent" || new Date(b.expires_at).getTime() < Date.now() ? "expired" : "open";

/** Public: GET /v1/scheduling/:token */
export async function getSchedulingInvite(req: Request, res: Response) {
  try {
    const b = await findBooking(String(req.params.token ?? ""));
    if (!b) return res.status(404).json({ message: "This scheduling link isn't valid." });
    const taken = await takenSlots(b.job_id, b.id);
    const now = Date.now();
    const slots = (Array.isArray(b.slots) ? (b.slots as string[]) : []).filter((s) => Date.parse(s) > now && !taken.has(s));
    res.json({
      candidate_first_name: b.first_name || "there",
      job_title: b.title,
      company_name: b.company,
      duration_min: b.duration_min,
      slots: statusOf(b) === "open" ? slots : [],
      status: statusOf(b),
      chosen_slot: b.chosen_slot ? new Date(b.chosen_slot).toISOString() : null,
    });
  } catch (err) {
    console.error("getSchedulingInvite error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

/** Public: POST /v1/scheduling/:token  { slot } */
export async function confirmSchedulingSlot(req: Request, res: Response) {
  const slotRaw = req.body?.slot;
  const slotMs = typeof slotRaw === "string" ? Date.parse(slotRaw) : NaN;
  if (!Number.isFinite(slotMs)) return res.status(400).json({ message: "Please choose a time." });
  const slot = new Date(slotMs).toISOString();

  const token = String(req.params.token ?? "");
  if (!/^[0-9a-f]{64}$/.test(token)) return res.status(404).json({ message: "This scheduling link isn't valid." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(
      `SELECT b.*, ja.job_id, ja.stage FROM interview_bookings b
         JOIN job_applications ja ON ja.id = b.application_id
        WHERE b.token_hash = $1 FOR UPDATE OF b`,
      [hashToken(token)],
    );
    const b = r.rows[0];
    if (!b) { await client.query("ROLLBACK"); return res.status(404).json({ message: "This scheduling link isn't valid." }); }
    if (statusOf(b) !== "open") { await client.query("ROLLBACK"); return res.status(410).json({ message: b.status === "booked" ? "You've already booked a time." : "This link has expired." }); }
    if (!(b.slots as string[]).includes(slot) || slotMs <= Date.now()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "That time isn't available. Please pick another." });
    }
    // Serialise bookings for the same job so two candidates can't take one slot.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`interview-slots:${b.job_id}`]);
    const clash = await client.query(
      `SELECT 1 FROM interview_bookings ib JOIN job_applications ja ON ja.id = ib.application_id
        WHERE ja.job_id = $1 AND ib.status = 'booked' AND ib.chosen_slot = $2 AND ib.id <> $3 LIMIT 1`,
      [b.job_id, slot, b.id],
    );
    if (clash.rows.length) { await client.query("ROLLBACK"); return res.status(409).json({ message: "Someone just took that time. Please pick another." }); }

    const iv = await client.query(
      `INSERT INTO interviews (tenant_id, application_id, interview_type, scheduled_at, duration_minutes, status)
       VALUES ($1, $2, 'video', $3, $4, 'scheduled') RETURNING id`,
      [b.tenant_id, b.application_id, slot, b.duration_min],
    );
    await client.query(
      `UPDATE interview_bookings SET status = 'booked', chosen_slot = $1, interview_id = $2, updated_at = now() WHERE id = $3`,
      [slot, iv.rows[0].id, b.id],
    );
    await client.query("COMMIT");

    if (b.stage !== "client_interview_scheduled") {
      await applyAiStageMove({ tenantId: b.tenant_id, applicationId: b.application_id, fromStage: b.stage, toStage: "client_interview_scheduled", note: "Candidate booked an interview slot" });
    }
    const who = await pool.query(`SELECT c.first_name, c.last_name FROM job_applications ja JOIN candidates c ON c.id = ja.candidate_id WHERE ja.id = $1`, [b.application_id]);
    const name = `${who.rows[0]?.first_name ?? ""} ${who.rows[0]?.last_name ?? ""}`.trim() || "Candidate";
    await recordEvent({ tenantId: b.tenant_id, jobId: b.job_id, applicationId: b.application_id, agent: "scheduler", action: "interview_booked", summary: `${name} booked an interview for ${new Date(slot).toUTCString()}.`, detail: { slot, interview_id: iv.rows[0].id } });

    res.json({ confirmed: true, slot, interview_id: iv.rows[0].id });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("confirmSchedulingSlot error:", err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
}
