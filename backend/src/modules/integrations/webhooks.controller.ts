import { Request, Response } from "express";
import pool from "../../db";
import * as sendgridSvc from "./services/sendgrid.service";
import * as calendlySvc from "./services/calendly.service";

// ─── SendGrid Event Webhook ──────────────────────────────────────────────────

export async function sendgridWebhook(req: Request, res: Response) {
  const signature = req.headers["x-twilio-email-event-webhook-signature"] as string;
  const timestamp = req.headers["x-twilio-email-event-webhook-timestamp"] as string;
  const rawBody = (req as any).rawBody as string;

  if (process.env.SENDGRID_WEBHOOK_PUBLIC_KEY) {
    const valid = sendgridSvc.verifyWebhookSignature(rawBody, signature, timestamp);
    if (!valid) return res.status(401).json({ message: "Invalid webhook signature" });
  }

  const events: any[] = Array.isArray(req.body) ? req.body : [];

  for (const event of events) {
    const email = event.email;
    const tenantId = event.tenant_id || event.unique_args?.tenant_id;

    if (!email || !tenantId) continue;

    try {
      if (event.event === "bounce" || event.event === "blocked") {
        await sendgridSvc.handleBounceEvent(tenantId, email, event.reason || event.type);
      } else if (event.event === "unsubscribe" || event.event === "spamreport") {
        await sendgridSvc.handleUnsubscribeEvent(tenantId, email);
      } else if (event.event === "delivered") {
        await pool.query(
          `UPDATE campaign_recipients SET delivered_at=NOW() WHERE campaign_id=$1 AND email=$2`,
          [event.campaign_id, email],
        );
      } else if (event.event === "open") {
        await pool.query(
          `UPDATE campaign_recipients SET opened_at=COALESCE(opened_at,NOW()), open_count=COALESCE(open_count,0)+1
           WHERE campaign_id=$1 AND email=$2`,
          [event.campaign_id, email],
        );
      } else if (event.event === "click") {
        await pool.query(
          `UPDATE campaign_recipients SET clicked_at=COALESCE(clicked_at,NOW()), click_count=COALESCE(click_count,0)+1
           WHERE campaign_id=$1 AND email=$2`,
          [event.campaign_id, email],
        );
      }
    } catch (err) {
      console.error("SendGrid webhook event error:", err);
    }
  }

  res.status(200).json({ received: events.length });
}

// ─── Calendly Webhook ───────────────────────────────────────────────────────

export async function calendlyWebhook(req: Request, res: Response) {
  const signature = req.headers["calendly-webhook-signature"] as string;
  const rawBody = (req as any).rawBody as string;

  if (process.env.CALENDLY_WEBHOOK_SECRET && signature) {
    const valid = calendlySvc.verifyCalendlyWebhook(rawBody, signature);
    if (!valid) return res.status(401).json({ message: "Invalid webhook signature" });
  }

  const payload = req.body;
  const event = payload?.event;
  const resource = payload?.payload;

  if (event === "invitee.created") {
    const schedulingLinkUri = resource?.tracking?.utm_source;
    const inviteeEmail = resource?.email;
    const inviteeName = resource?.name;
    const startTime = resource?.scheduled_event?.start_time;
    const endTime = resource?.scheduled_event?.end_time;
    const eventUri = resource?.scheduled_event?.uri;

    if (schedulingLinkUri) {
      try {
        const linkRes = await pool.query(
          `SELECT * FROM scheduling_links WHERE calendly_link_uri=$1`,
          [schedulingLinkUri],
        );

        if (linkRes.rows[0]) {
          const link = linkRes.rows[0];
          await pool.query(
            `UPDATE scheduling_links SET status='booked', booked_at=NOW(), invitee_email=$1, invitee_name=$2,
             calendly_event_uri=$3, scheduled_start=$4, scheduled_end=$5 WHERE id=$6`,
            [inviteeEmail, inviteeName, eventUri, startTime, endTime, link.id],
          );

          if (link.interview_id) {
            await pool.query(
              `UPDATE interviews SET scheduled_at=$1, status='confirmed', calendly_event_uri=$2 WHERE id=$3`,
              [startTime, eventUri, link.interview_id],
            );
          }
        }
      } catch (err) {
        console.error("Calendly webhook error:", err);
      }
    }
  } else if (event === "invitee.canceled") {
    const eventUri = resource?.scheduled_event?.uri;
    if (eventUri) {
      try {
        await pool.query(
          `UPDATE scheduling_links SET status='cancelled' WHERE calendly_event_uri=$1`,
          [eventUri],
        );
        await pool.query(
          `UPDATE interviews SET status='cancelled' WHERE calendly_event_uri=$1`,
          [eventUri],
        );
      } catch (err) {
        console.error("Calendly cancel webhook error:", err);
      }
    }
  }

  res.status(200).json({ received: true });
}
