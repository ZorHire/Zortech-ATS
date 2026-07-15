import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/v1/integrations/auth/google/callback",
);

export function getGoogleAuthUrl(userId: string, tenantId: string): string {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state: JSON.stringify({ userId, tenantId }),
  });
}

export async function exchangeGoogleCode(code: string): Promise<{ access_token: string; refresh_token: string; expiry_date: number }> {
  const { tokens } = await oauth2Client.getToken(code);
  return {
    access_token: tokens.access_token || "",
    refresh_token: tokens.refresh_token || "",
    expiry_date: tokens.expiry_date || 0,
  };
}

export async function createGoogleCalendarEvent(opts: {
  accessToken: string;
  refreshToken: string;
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  attendeeEmails: string[];
  meetLink?: boolean;
}) {
  oauth2Client.setCredentials({
    access_token: opts.accessToken,
    refresh_token: opts.refreshToken,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const event: any = {
    summary: opts.summary,
    description: opts.description,
    start: { dateTime: opts.startTime, timeZone: "UTC" },
    end: { dateTime: opts.endTime, timeZone: "UTC" },
    attendees: opts.attendeeEmails.map((email) => ({ email })),
  };

  if (opts.meetLink) {
    event.conferenceData = {
      createRequest: { requestId: `meet-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } },
    };
  }

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: event,
    conferenceDataVersion: opts.meetLink ? 1 : 0,
  });

  return response.data;
}

export async function deleteGoogleCalendarEvent(accessToken: string, refreshToken: string, eventId: string) {
  oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  await calendar.events.delete({ calendarId: "primary", eventId });
}
