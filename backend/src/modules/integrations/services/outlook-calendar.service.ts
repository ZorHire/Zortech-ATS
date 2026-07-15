import { ConfidentialClientApplication } from "@azure/msal-node";
import pool from "../../../db";

const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || "",
    clientSecret: process.env.AZURE_CLIENT_SECRET || "",
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || "common"}`,
  },
};

const msalClient = new ConfidentialClientApplication(msalConfig);

export function getOutlookAuthUrl(userId: string, tenantId: string): string {
  const redirectUri = process.env.OUTLOOK_REDIRECT_URI || "http://localhost:5000/v1/integrations/auth/outlook/callback";
  const state = Buffer.from(JSON.stringify({ userId, tenantId })).toString("base64");
  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID || "",
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "Calendars.ReadWrite offline_access",
    state,
  });
  return `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || "common"}/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeOutlookCode(code: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const redirectUri = process.env.OUTLOOK_REDIRECT_URI || "http://localhost:5000/v1/integrations/auth/outlook/callback";
  const body = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID || "",
    client_secret: process.env.AZURE_CLIENT_SECRET || "",
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const resp = await fetch(`https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || "common"}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!resp.ok) throw new Error("Outlook token exchange failed");
  return resp.json() as any;
}

export async function createOutlookCalendarEvent(opts: {
  accessToken: string;
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  attendeeEmails: string[];
  meetLink?: boolean;
}) {
  const event: any = {
    subject: opts.summary,
    body: { contentType: "HTML", content: opts.description },
    start: { dateTime: opts.startTime, timeZone: "UTC" },
    end: { dateTime: opts.endTime, timeZone: "UTC" },
    attendees: opts.attendeeEmails.map((email) => ({
      emailAddress: { address: email },
      type: "required",
    })),
  };

  if (opts.meetLink) {
    event.isOnlineMeeting = true;
    event.onlineMeetingProvider = "teamsForBusiness";
  }

  const resp = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!resp.ok) {
    const err = await resp.json() as any;
    throw new Error(err?.error?.message || "Outlook event creation failed");
  }
  return resp.json();
}

export async function deleteOutlookCalendarEvent(accessToken: string, eventId: string) {
  await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
