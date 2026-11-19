import type { ReactNode } from "react";
import { getStage } from "../../lib/stages";

export type BadgeTone = "neutral" | "navy" | "brand" | "success" | "warning" | "danger" | "info";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-ink-soft ring-line",
  navy: "bg-navy-50 text-navy-700 ring-navy-100",
  brand: "bg-brand-50 text-brand-800 ring-brand-100",
  success: "bg-success-50 text-success-700 ring-emerald-100",
  warning: "bg-warning-50 text-warning-700 ring-brand-100",
  danger: "bg-danger-50 text-danger-700 ring-red-100",
  info: "bg-sky-50 text-sky-800 ring-sky-100",
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export default function Badge({ tone = "neutral", children, icon, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}

/** Pipeline stage pill with the shared label and colour from lib/stages. */
export function StageBadge({ stage, short, className = "" }: { stage: string | null | undefined; short?: boolean; className?: string }) {
  const s = getStage(stage);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.badge} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.group === "closed" ? "bg-white" : s.dot}`} aria-hidden="true" />
      {short ? s.short : s.label}
    </span>
  );
}
