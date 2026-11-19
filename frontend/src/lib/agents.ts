import type { LucideIcon } from "lucide-react";
import { Bot, CalendarCheck, MessagesSquare, Sparkles } from "lucide-react";
import type { BadgeTone } from "../components/ui";
import type { AgentEvent } from "../types/agents";

/** Display info for each agent in feeds and filters. */
export const AGENT_META: Record<AgentEvent["agent"], { label: string; icon: LucideIcon }> = {
  shortlister: { label: "Shortlister", icon: Sparkles },
  screener: { label: "Screening interviewer", icon: MessagesSquare },
  scheduler: { label: "Scheduler", icon: CalendarCheck },
  system: { label: "System", icon: Bot },
};

const ACTION_META: Record<string, { label: string; tone: BadgeTone }> = {
  shortlisted: { label: "Shortlisted", tone: "success" },
  needs_review: { label: "Needs review", tone: "warning" },
  screening_invited: { label: "Screening invited", tone: "navy" },
  screening_completed: { label: "Screening completed", tone: "info" },
  screening_passed: { label: "Screening passed", tone: "success" },
  schedule_link_sent: { label: "Scheduling link sent", tone: "navy" },
  interview_booked: { label: "Interview booked", tone: "success" },
  skipped: { label: "Skipped", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
  paused: { label: "Paused", tone: "neutral" },
};

/** Unknown actions fall back to a readable label in a neutral tone. */
export function actionMeta(action: string): { label: string; tone: BadgeTone } {
  const known = ACTION_META[action];
  if (known) return known;
  const label = action.replace(/_/g, " ");
  return { label: label.charAt(0).toUpperCase() + label.slice(1), tone: "neutral" };
}

export function agentMeta(agent: string) {
  return AGENT_META[agent as AgentEvent["agent"]] ?? AGENT_META.system;
}

/** Score colour: green ≥ 75, amber ≥ 50, red below. */
export function scoreTone(score: number): "success" | "warning" | "danger" {
  if (score >= 75) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

const DATE_TIME = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : DATE_TIME.format(d);
}

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

/** "5 minutes ago", "yesterday"… in the user's locale. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  let value = (t - now) / 1000;
  if (Math.abs(value) < 45) return RELATIVE.format(0, "second");
  for (const [unit, size] of STEPS) {
    if (Math.abs(value) < size) return RELATIVE.format(Math.round(value), unit);
    value /= size;
  }
  return "";
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}
