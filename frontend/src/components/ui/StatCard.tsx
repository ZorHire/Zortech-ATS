import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Small text under the value (e.g. "3 this week"). Never invent numbers here. */
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "navy" | "brand" | "success" | "danger" | "neutral";
  onClick?: () => void;
  loading?: boolean;
}

const ICON_TONES = {
  navy: "bg-navy-50 text-navy-600",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-700",
  danger: "bg-danger-50 text-danger-600",
  neutral: "bg-surface-sunken text-muted",
};

export default function StatCard({ label, value, hint, icon, tone = "navy", onClick, loading }: StatCardProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`zh-card flex w-full items-start justify-between gap-3 p-4 text-left sm:p-5 ${
        onClick ? "transition hover:border-line-strong hover:shadow-md" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        {loading ? (
          <div className="mt-2 h-7 w-14 animate-pulse rounded bg-surface-sunken" aria-hidden="true" />
        ) : (
          <p className="mt-1 font-display text-2xl font-semibold text-ink">{value}</p>
        )}
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
      {icon && <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ICON_TONES[tone]}`}>{icon}</div>}
    </Comp>
  );
}
