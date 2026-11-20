import Badge from "../ui/Badge";
import type { BadgeTone } from "../ui/Badge";

/**
 * One mapping for job status, job priority and person avatars, shared by the
 * Jobs, Job detail, Pipeline, Candidates and Dashboard screens.
 */

const JOB_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  pending_review: { label: "Pending review", tone: "warning" },
  active: { label: "Active", tone: "success" },
  on_hold: { label: "On hold", tone: "warning" },
  closed_filled: { label: "Filled", tone: "navy" },
  closed_cancelled: { label: "Cancelled", tone: "danger" },
  expired: { label: "Expired", tone: "neutral" },
};

const PRIORITY: Record<string, { label: string; tone: BadgeTone }> = {
  low: { label: "Low", tone: "neutral" },
  medium: { label: "Medium", tone: "navy" },
  high: { label: "High", tone: "warning" },
  critical: { label: "Critical", tone: "danger" },
};

const humanize = (v: string) => (v ? v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Unknown");

export function jobStatusLabel(status: string | null | undefined): string {
  const s = status ?? "";
  return JOB_STATUS[s]?.label ?? humanize(s);
}

export function JobStatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const s = status ?? "";
  return (
    <Badge tone={JOB_STATUS[s]?.tone ?? "neutral"} className={className}>
      {JOB_STATUS[s]?.label ?? humanize(s)}
    </Badge>
  );
}

export function PriorityBadge({ priority, className }: { priority: string | null | undefined; className?: string }) {
  const p = (priority ?? "").toLowerCase();
  if (!p) return null;
  return (
    <Badge tone={PRIORITY[p]?.tone ?? "neutral"} className={className}>
      {PRIORITY[p]?.label ?? humanize(p)}
    </Badge>
  );
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "")).toUpperCase();
}

const AVATAR_SIZES = { xs: "h-6 w-6 text-[10px]", sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg" };

/** Navy initials circle used for candidates and people everywhere. */
export function Avatar({
  name,
  size = "sm",
  className = "",
}: {
  name: string | null | undefined;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-navy-600 font-semibold text-white ${AVATAR_SIZES[size]} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
