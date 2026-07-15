const CALENDLY_BASE = "https://api.calendly.com";

function getHeaders() {
  const token = process.env.CALENDLY_API_KEY;
  if (!token) throw new Error("CALENDLY_API_KEY not configured");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function calendlyFetch(path: string, opts: RequestInit = {}) {
  const resp = await fetch(`${CALENDLY_BASE}${path}`, {
    ...opts,
    headers: { ...getHeaders(), ...(opts.headers as any) },
  });
  if (!resp.ok) {
    const err = await resp.json() as any;
    throw new Error(err?.message || `Calendly API error: ${resp.status}`);
  }
  return resp.json();
}

export async function getCurrentUser(): Promise<{ uri: string; email: string; name: string }> {
  const data = await calendlyFetch("/users/me") as any;
  return { uri: data.resource.uri, email: data.resource.email, name: data.resource.name };
}

export async function listEventTypes(userUri: string): Promise<Array<{ uri: string; name: string; duration: number; scheduling_url: string }>> {
  const data = await calendlyFetch(`/event_types?user=${encodeURIComponent(userUri)}&active=true`) as any;
  return data.collection.map((et: any) => ({
    uri: et.uri,
    name: et.name,
    duration: et.duration,
    scheduling_url: et.scheduling_url,
  }));
}

export async function createOneOffSchedulingLink(opts: {
  ownerUri: string;
  maxEventCount?: number;
  name?: string;
}): Promise<{ booking_url: string; owner: string; owner_type: string }> {
  const data = await calendlyFetch("/scheduling_links", {
    method: "POST",
    body: JSON.stringify({
      max_event_count: opts.maxEventCount || 1,
      owner: opts.ownerUri,
      owner_type: "EventType",
    }),
  }) as any;
  return data.resource;
}

export async function getScheduledEvent(eventUri: string): Promise<{
  uri: string;
  name: string;
  status: string;
  start_time: string;
  end_time: string;
  invitees_counter: { total: number };
}> {
  const parts = eventUri.split("/");
  const uuid = parts[parts.length - 1];
  const data = await calendlyFetch(`/scheduled_events/${uuid}`) as any;
  return data.resource;
}

export async function listEventInvitees(eventUri: string): Promise<Array<{
  email: string;
  name: string;
  status: string;
}>> {
  const parts = eventUri.split("/");
  const uuid = parts[parts.length - 1];
  const data = await calendlyFetch(`/scheduled_events/${uuid}/invitees`) as any;
  return data.collection.map((inv: any) => ({
    email: inv.email,
    name: inv.name,
    status: inv.status,
  }));
}

export function verifyCalendlyWebhook(payload: string, signature: string): boolean {
  try {
    const secret = process.env.CALENDLY_WEBHOOK_SECRET;
    if (!secret) return false;
    const crypto = require("crypto");
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
