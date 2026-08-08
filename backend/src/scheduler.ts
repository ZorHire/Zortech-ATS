import cron from "node-cron";
import pool from "./db";
import { dispatchScheduledCampaign } from "./modules/email/campaigns.controller";

export function startScheduler(): void {
  // Nightly at 00:05 — expire overdue jobs and vendor contracts
  cron.schedule("5 0 * * *", async () => {
    try {
      // 1. Mark active jobs as expired when target_start_date has passed
      const jobResult = await pool.query(
        `UPDATE jobs
         SET status = 'expired', updated_at = now()
         WHERE status = 'active'
           AND target_start_date IS NOT NULL
           AND target_start_date::date < CURRENT_DATE`,
      );
      if ((jobResult.rowCount ?? 0) > 0) {
        console.log(`[Cron] Expired ${jobResult.rowCount} job(s) past SLA`);
      }

      // 2. Mark active vendor contracts as expired when end_date has passed
      const contractResult = await pool.query(
        `UPDATE vendor_contracts
         SET status = 'expired', updated_at = now()
         WHERE status = 'active'
           AND end_date IS NOT NULL
           AND end_date::date < CURRENT_DATE`,
      );
      if ((contractResult.rowCount ?? 0) > 0) {
        console.log(
          `[Cron] Expired ${contractResult.rowCount} vendor contract(s)`,
        );
      }
    } catch (error) {
      console.error("[Cron] Nightly expiry task failed:", error);
    }
  });

  // Scheduled campaigns — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date().toISOString();
      // Atomically claim campaigns to prevent double-send across instances
      const due = await pool.query(
        `UPDATE email_campaigns SET status='sending'
         WHERE status='scheduled' AND scheduled_at <= $1
         RETURNING *`,
        [now]
      );
      for (const campaign of due.rows) {
        try {
          const { deliveredCount } = await dispatchScheduledCampaign(
            campaign.id,
            campaign.tenant_id,
            campaign.created_by,
          );
          await pool.query(
            "UPDATE email_campaigns SET status='sent', delivered_count=$1, sent_at=now() WHERE id=$2",
            [deliveredCount, campaign.id]
          );
          console.log(`[scheduler] Campaign ${campaign.id} sent, delivered=${deliveredCount}`);
        } catch (sendErr) {
          console.error(`[scheduler] Failed to send campaign ${campaign.id}:`, sendErr);
          // Roll back to scheduled so it retries next tick
          await pool.query(
            "UPDATE email_campaigns SET status='scheduled' WHERE id=$1",
            [campaign.id]
          );
        }
      }
    } catch(e) { console.error('[scheduler] campaign-send error:', e); }
  });

  // Vendor document expiry alerts — daily at 8am
  cron.schedule('0 8 * * *', async () => {
    try {
      const alerts = await pool.query(`
        SELECT vd.*, v.name as vendor_name, v.contact_email,
               t.id as tenant_id
        FROM vendor_documents vd
        JOIN vendors v ON v.id = vd.vendor_id
        JOIN tenants t ON t.id = vd.tenant_id
        WHERE vd.status = 'active'
          AND vd.expiry_date IS NOT NULL
          AND vd.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
          AND vd.expiry_date >= CURRENT_DATE
      `);
      for (const doc of alerts.rows) {
        const daysLeft = Math.ceil((new Date(doc.expiry_date).getTime() - Date.now()) / 86400000);
        console.log(`[scheduler] Vendor doc expiry alert: vendor=${doc.vendor_name} doc=${doc.document_type} days=${daysLeft}`);
        // TODO: send email notification when SMTP is configured per tenant
      }
    } catch(e) { console.error('[scheduler] vendor-doc-expiry error:', e); }
  });

  // Daily digest — every day at 7am
  cron.schedule('0 7 * * *', async () => {
    try {
      const tenants = await pool.query(
        "SELECT tenant_id, digest_recipients FROM report_preferences WHERE daily_digest_enabled = true"
      );
      for (const t of tenants.rows) {
        if (!t.digest_recipients || t.digest_recipients.length === 0) continue;
        const stats = await pool.query(`
          SELECT
            (SELECT count(*) FROM jobs WHERE tenant_id=$1 AND status='active') as active_jobs,
            (SELECT count(*) FROM job_applications WHERE tenant_id=$1 AND created_at >= now()-interval '24 hours') as new_applications,
            (SELECT count(*) FROM interviews WHERE tenant_id=$1 AND scheduled_at::date = CURRENT_DATE) as interviews_today,
            (SELECT count(*) FROM job_applications WHERE tenant_id=$1 AND stage='offer_extended') as pending_offers
        `, [t.tenant_id]);
        const s = stats.rows[0];
        console.log(`[scheduler] Daily digest for tenant ${t.tenant_id}:`, s);
        // TODO: send formatted email to t.digest_recipients
      }
    } catch(e) { console.error('[scheduler] daily-digest error:', e); }
  });

  // Notification cleanup — weekly at 02:30, delete read notifications > 90 days old
  cron.schedule('30 2 * * 0', async () => {
    try {
      const result = await pool.query(
        `DELETE FROM notifications WHERE read_at IS NOT NULL AND created_at < NOW() - INTERVAL '90 days'`
      );
      if ((result.rowCount ?? 0) > 0) {
        console.log(`[scheduler] Cleaned up ${result.rowCount} old read notifications`);
      }
    } catch(e) { console.error('[scheduler] notification-cleanup error:', e); }
  });

  console.log(
    "[Scheduler] Nightly expiry cron registered — runs daily at 00:05",
  );
  console.log("[Scheduler] Scheduled campaigns cron registered — runs every 5 minutes");
  console.log("[Scheduler] Vendor document expiry alerts cron registered — runs daily at 08:00");
  console.log("[Scheduler] Daily digest cron registered — runs daily at 07:00");
  console.log("[Scheduler] Notification cleanup cron registered — runs weekly Sunday at 02:30");
}
