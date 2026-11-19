/**
 * Single source of truth for pipeline stages: order, labels and colours.
 * Matches the CHECK constraint on applications.stage in backend/src/db/schema.sql.
 * Screens used to define these separately and disagreed (e.g. "screened" was
 * indigo, amber, cyan or violet depending on the page).
 */

export type StageKey =
  | "new"
  | "sourced"
  | "screened"
  | "shortlisted"
  | "submitted_to_client"
  | "client_interview_scheduled"
  | "interview_completed"
  | "selected"
  | "offer_extended"
  | "offer_accepted"
  | "offer_rejected"
  | "joined"
  | "disqualified";

export type StageGroup = "early" | "client" | "offer" | "closed" | "lost";

export interface StageDef {
  key: StageKey;
  label: string;
  short: string;
  group: StageGroup;
  /** Tailwind classes for a pill/badge. */
  badge: string;
  /** Tailwind class for a small status dot / column accent. */
  dot: string;
}

const TONE: Record<StageGroup, { badge: string; dot: string }> = {
  early: { badge: "bg-navy-50 text-navy-700 ring-navy-100", dot: "bg-navy-400" },
  client: { badge: "bg-brand-50 text-brand-800 ring-brand-100", dot: "bg-brand-500" },
  offer: { badge: "bg-success-50 text-success-700 ring-emerald-100", dot: "bg-emerald-500" },
  closed: { badge: "bg-emerald-600 text-white ring-emerald-600", dot: "bg-emerald-600" },
  lost: { badge: "bg-danger-50 text-danger-700 ring-red-100", dot: "bg-red-400" },
};

function def(key: StageKey, label: string, short: string, group: StageGroup): StageDef {
  return { key, label, short, group, ...TONE[group] };
}

export const STAGES: StageDef[] = [
  def("new", "New", "New", "early"),
  def("sourced", "Sourced", "Sourced", "early"),
  def("screened", "Screened", "Screened", "early"),
  def("shortlisted", "Shortlisted", "Shortlisted", "early"),
  def("submitted_to_client", "Submitted to client", "Submitted", "client"),
  def("client_interview_scheduled", "Interview scheduled", "Interview", "client"),
  def("interview_completed", "Interview completed", "Interviewed", "client"),
  def("selected", "Selected", "Selected", "offer"),
  def("offer_extended", "Offer extended", "Offer out", "offer"),
  def("offer_accepted", "Offer accepted", "Accepted", "offer"),
  def("offer_rejected", "Offer declined", "Declined", "lost"),
  def("joined", "Joined", "Joined", "closed"),
  def("disqualified", "Disqualified", "Disqualified", "lost"),
];

const BY_KEY = new Map(STAGES.map((s) => [s.key, s]));

/** Older screens/data used these keys. */
const LEGACY: Record<string, StageKey> = {
  screening: "screened",
  interview: "client_interview_scheduled",
  interviewing: "client_interview_scheduled",
  submitted: "submitted_to_client",
  offer: "offer_extended",
  hired: "joined",
  rejected: "disqualified",
};

export function getStage(key: string | null | undefined): StageDef {
  const k = (key ?? "").toLowerCase();
  const found = BY_KEY.get(k as StageKey) ?? BY_KEY.get(LEGACY[k]);
  if (found) return found;
  // Unknown key: show it readably instead of "submitted_to_client".
  const label = k ? k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Unknown";
  return { key: k as StageKey, label, short: label, group: "early", ...TONE.early };
}

export const stageLabel = (key: string | null | undefined) => getStage(key).label;
