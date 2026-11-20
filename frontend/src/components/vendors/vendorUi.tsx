import type { ElementType } from "react";
import { AlertTriangle, Award, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "../ui";
import type { BadgeTone } from "../ui";
import type { VendorDocsStatus } from "../../store/api/vendorApi";

/** Internal vendor tiers. Staff-facing only: never show these in the vendor portal. */
export const tierConfig: Record<string, { label: string; tone: BadgeTone; icon: ElementType }> = {
  preferred: { label: "Preferred", tone: "success", icon: Award },
  standard: { label: "Standard", tone: "navy", icon: CheckCircle2 },
  blocked: { label: "Blocked", tone: "danger", icon: XCircle },
};

export function getTier(tier: string | null | undefined) {
  return tierConfig[tier ?? ""] ?? tierConfig.standard;
}

export function TierBadge({ tier }: { tier: string | null | undefined }) {
  const t = getTier(tier);
  const Icon = t.icon;
  return (
    <Badge tone={t.tone} icon={<Icon size={12} aria-hidden="true" />}>
      {t.label}
    </Badge>
  );
}

/** Bar colour for a 0-100 quality score. */
export function qualityColor(score: number): string {
  return score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-brand-500" : "bg-red-400";
}

/** Bar colour for a 0-100 SLA adherence score. */
export function slaColor(score: number): string {
  return score >= 85 ? "bg-navy-500" : score >= 65 ? "bg-brand-500" : "bg-red-400";
}

/** Compact percentage bar used in vendor tables. */
export function ScoreBar({
  value,
  max = 100,
  color,
  className = "",
}: {
  value: number;
  max?: number;
  color: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (Number(value) / max) * 100 || 0));
  return (
    <div className={`flex min-w-[100px] items-center gap-2 ${className}`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-xs font-medium text-ink-soft">{value}%</span>
    </div>
  );
}

/** Initial-letter tile for a vendor company. */
export function VendorAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const cls =
    size === "lg" ? "h-14 w-14 text-xl rounded-xl" : size === "sm" ? "h-8 w-8 text-xs rounded-lg" : "h-10 w-10 text-sm rounded-lg";
  return (
    <span className={`flex shrink-0 items-center justify-center bg-navy-600 font-semibold text-white ${cls}`} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

const docsStatusConfig: Record<VendorDocsStatus, { label: string; tone: BadgeTone; icon: ElementType; hint: string }> = {
  onboarded: { label: "Onboarded", tone: "success", icon: CheckCircle2, hint: "NDA and service agreement on file" },
  pending: { label: "Docs pending", tone: "warning", icon: Clock, hint: "NDA or service agreement missing" },
  expired: { label: "Expired", tone: "danger", icon: AlertTriangle, hint: "A required document has expired" },
};

/** Onboarding paperwork pill: Onboarded / Docs pending / Expired. */
export function DocsStatusBadge({ status, className = "" }: { status: VendorDocsStatus | null | undefined; className?: string }) {
  const c = docsStatusConfig[status ?? "pending"] ?? docsStatusConfig.pending;
  const Icon = c.icon;
  return (
    <span title={c.hint} className="inline-flex">
      <Badge tone={c.tone} icon={<Icon size={12} aria-hidden="true" />} className={className}>
        {c.label}
      </Badge>
    </span>
  );
}
