import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useGetAiUsageQuery, type AiMeter } from "../../store/api/aiUsageApi";

/**
 * Warns when one of the given AI allowances is at 80% or used up this month.
 * Renders nothing otherwise (or while loading / on error).
 */
export default function AiUsageBanner({ meters }: { meters: AiMeter[] }) {
  const { data } = useGetAiUsageQuery(undefined, { pollingInterval: 5 * 60_000 });
  if (!data || data.unlimited) return null;
  const hits = data.meters.filter((m) => meters.includes(m.key) && m.limit !== null && m.limit > 0 && (m.percent ?? 0) >= 80);
  if (!hits.length) return null;
  const out = hits.filter((m) => (m.percent ?? 0) >= 100);
  const near = hits.filter((m) => (m.percent ?? 0) < 100);
  const resets = new Date(data.resets_at).toLocaleDateString("en-IN", { day: "numeric", month: "long" });
  const parts = out.map((m) =>
    m.key === "linkedin_prospects"
      ? `${m.label}: this month's allowance is used up, so new people get a keyword score and template note until ${resets}.`
      : `${m.label}: this month's allowance is used up, so new actions are paused until ${resets}.`,
  );
  if (near.length) parts.push(`${near.map((m) => `${m.label} ${m.percent}%`).join(", ")} of this month's allowance used.`);
  const text = parts.join(" ");
  return (
    <div role="status" className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${out.length ? "bg-danger-50 text-danger-700" : "bg-warning-50 text-warning-700"}`}>
      <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
      <p>
        {text}{" "}
        <Link to="/settings/ai-usage" className="font-medium underline underline-offset-2">See AI usage</Link>
      </p>
    </div>
  );
}
