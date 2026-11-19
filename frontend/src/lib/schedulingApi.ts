import type { SchedulingConfirmation, SchedulingInvite } from "../types/agents";

/**
 * Public (candidate-facing) slot picker API. No auth: plain fetch, like the
 * screening chat page. Never sends the recruiter's JWT.
 */
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/v1";

export type SchedulingErrorKind = "invalid" | "expired" | "slot_taken" | "network" | "server";

export class SchedulingError extends Error {
  kind: SchedulingErrorKind;
  status?: number;
  constructor(kind: SchedulingErrorKind, message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit, isBooking = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new SchedulingError("network", "We couldn't reach the server. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  if (res.ok) return data as T;
  const msg = typeof data.message === "string" ? data.message : typeof data.error === "string" ? data.error : "";
  // While booking, 400 means the chosen time isn't offered (any more), not a bad link.
  if ((res.status === 409 || res.status === 400) && isBooking) {
    throw new SchedulingError("slot_taken", msg || "That time is no longer available. Please pick another.", res.status);
  }
  if (res.status === 404 || res.status === 400) {
    throw new SchedulingError("invalid", msg || "This scheduling link isn't valid.", res.status);
  }
  if (res.status === 410) {
    throw new SchedulingError("expired", msg || "This scheduling link has expired.", res.status);
  }
  throw new SchedulingError("server", msg || "Something went wrong on our side. Please try again shortly.", res.status);
}

export function getSchedulingInvite(token: string): Promise<SchedulingInvite> {
  return request<SchedulingInvite>(`/scheduling/${encodeURIComponent(token)}`);
}

export function confirmSchedulingSlot(token: string, slot: string): Promise<SchedulingConfirmation> {
  return request<SchedulingConfirmation>(`/scheduling/${encodeURIComponent(token)}`, {
    method: "POST",
    body: JSON.stringify({ slot }),
  }, true);
}
