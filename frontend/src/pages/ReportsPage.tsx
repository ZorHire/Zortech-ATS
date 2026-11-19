import React from "react";
import {
  Download,
  BarChart2,
  Users,
  TrendingUp,
  FileText,
  Briefcase,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { useGetAnalyticsQuery } from "../store/api/analyticsApi";
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatCard,
} from "../components/ui";
import { getStage } from "../lib/stages";

type Preset = "30d" | "90d" | "6m" | "1y" | "all";
type ReportType = "placement" | "recruiter" | "funnel";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "6m", label: "Last 6 months" },
  { key: "1y", label: "Last year" },
  { key: "all", label: "All time" },
];

const REPORT_TYPES: { key: ReportType; label: string; description: string; icon: React.ElementType }[] = [
  {
    key: "placement",
    label: "Placement report",
    description: "Monthly placements, offer acceptance rate, and pipeline summary",
    icon: TrendingUp,
  },
  {
    key: "recruiter",
    label: "Recruiter performance",
    description: "Jobs assigned, candidates sourced, submissions, and placements per recruiter",
    icon: Users,
  },
  {
    key: "funnel",
    label: "Hiring funnel",
    description: "Conversion rates at each stage of the recruitment pipeline",
    icon: BarChart2,
  },
];

const TH = "border-b border-line px-4 py-2.5 text-left text-xs font-medium text-muted";
const TD = "px-4 py-3 align-middle text-ink";

function getDateRange(preset: Preset): { from?: string; to?: string } {
  if (preset === "all") return {};
  const to = new Date();
  const from = new Date();
  if (preset === "30d") from.setDate(from.getDate() - 30);
  else if (preset === "90d") from.setDate(from.getDate() - 90);
  else if (preset === "6m") from.setMonth(from.getMonth() - 6);
  else if (preset === "1y") from.setFullYear(from.getFullYear() - 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: T; label: string; icon?: React.ElementType }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="min-w-0 max-w-full">
      <p className="mb-1.5 text-xs font-medium text-muted">{label}</p>
      <div
        role="group"
        aria-label={label}
        className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-surface-sunken p-1"
      >
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={value === o.key}
            onClick={() => onChange(o.key)}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              value === o.key ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {o.icon && <o.icon size={13} aria-hidden="true" />}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [preset, setPreset] = React.useState<Preset>("90d");
  const [reportType, setReportType] = React.useState<ReportType>("placement");

  const dateRange = getDateRange(preset);
  const { data, isLoading, isFetching, isError, error, refetch } = useGetAnalyticsQuery(
    preset === "all" ? undefined : dateRange,
  );

  const handleDownload = () => {
    const base = import.meta.env.VITE_API_URL || "/v1";
    const params = new URLSearchParams();
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    const qs = params.toString();
    window.open(`${base}/admin/analytics/export${qs ? `?${qs}` : ""}`, "_blank");
  };

  const summary = data?.summary;
  const funnel = data?.funnel ?? [];
  const recruiters = data?.recruiters ?? [];
  const monthly = data?.monthly ?? [];
  const maxMonthly = Math.max(...monthly.map((m) => m.count), 1);
  const totalInFunnel = funnel[0]?.count ?? 0;
  const rt = REPORT_TYPES.find((r) => r.key === reportType)!;
  const acceptRate =
    summary?.offer_accept_rate != null ? `${summary.offer_accept_rate}%` : "—";

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Generate and download detailed recruitment reports"
        actions={
          <Button icon={<Download size={16} />} onClick={handleDownload}>
            Download CSV
          </Button>
        }
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-end gap-4">
          <Segmented label="Date range" options={PRESETS} value={preset} onChange={setPreset} />
          <Segmented
            label="Report type"
            options={REPORT_TYPES}
            value={reportType}
            onChange={setReportType}
          />
        </div>

        {isError ? (
          <div className="zh-card">
            <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Total placements"
                value={summary?.total_placements ?? 0}
                icon={<CheckCircle2 size={18} />}
                tone="success"
                loading={isLoading}
              />
              <StatCard
                label="Active jobs"
                value={summary?.active_jobs ?? 0}
                icon={<Briefcase size={18} />}
                tone="navy"
                loading={isLoading}
              />
              <StatCard
                label="Pending offers"
                value={summary?.pending_offers ?? 0}
                icon={<Clock size={18} />}
                tone="brand"
                loading={isLoading}
              />
              <StatCard
                label="Offer accept rate"
                value={acceptRate}
                icon={<TrendingUp size={18} />}
                tone="neutral"
                loading={isLoading}
              />
            </div>

            <section className="zh-card overflow-hidden" aria-labelledby="report-title">
              <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
                    <rt.icon size={18} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 id="report-title" className="text-sm font-semibold text-ink">
                      {rt.label}
                    </h2>
                    <p className="text-xs text-muted">{rt.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted sm:ml-auto">
                  <FileText size={13} aria-hidden="true" />
                  {preset === "all" ? "All time" : `${dateRange.from} → ${dateRange.to}`}
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-3 p-4 sm:p-6" role="status" aria-label="Generating report">
                  <Skeleton className="h-36 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <div className="p-4 sm:p-6">
                  {reportType === "placement" && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="mb-4 text-sm font-semibold text-ink">Placements by month</h3>
                        {monthly.length === 0 ? (
                          <EmptyState
                            compact
                            title="No placement data for this period"
                            description="Try a longer date range."
                            action={
                              preset !== "all" ? (
                                <Button variant="secondary" size="sm" onClick={() => setPreset("all")}>
                                  Show all time
                                </Button>
                              ) : undefined
                            }
                          />
                        ) : (
                          <div className="overflow-x-auto">
                            <div className="flex h-40 min-w-max items-end gap-3 sm:min-w-0">
                              {monthly.map((m) => (
                                <div
                                  key={m.label}
                                  className="flex min-w-[2.5rem] flex-1 flex-col items-center gap-1"
                                >
                                  <span className="text-xs font-semibold text-ink">{m.count}</span>
                                  <div
                                    className="w-full rounded-t-md bg-navy-600 transition-all"
                                    style={{ height: `${Math.max((m.count / maxMonthly) * 100, 4)}px` }}
                                  />
                                  <span className="whitespace-nowrap text-xs text-muted">{m.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {summary && (
                        <table className="w-full text-sm">
                          <caption className="sr-only">Placement summary</caption>
                          <tbody>
                            {[
                              ["Total placements (period)", summary.total_placements],
                              ["Active jobs (current)", summary.active_jobs],
                              ["Pending offers (current)", summary.pending_offers],
                              ["Offer acceptance rate", acceptRate],
                              ["Candidates in pipeline", summary.total_candidates],
                            ].map(([label, val]) => (
                              <tr key={String(label)} className="border-b border-line last:border-0">
                                <th scope="row" className="py-2.5 text-left text-sm font-normal text-muted">
                                  {label}
                                </th>
                                <td className="py-2.5 text-right font-semibold text-ink">{val}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {reportType === "recruiter" &&
                    (recruiters.length === 0 ? (
                      <EmptyState
                        compact
                        icon={<Users size={22} aria-hidden="true" />}
                        title="No recruiter data for this period"
                        description="Try a longer date range."
                        action={
                          preset !== "all" ? (
                            <Button variant="secondary" size="sm" onClick={() => setPreset("all")}>
                              Show all time
                            </Button>
                          ) : undefined
                        }
                      />
                    ) : (
                      <div className="-mx-4 overflow-x-auto sm:-mx-6">
                        <table className="w-full min-w-[640px] border-collapse text-sm">
                          <caption className="sr-only">Recruiter performance</caption>
                          <thead className="bg-surface">
                            <tr>
                              {["Recruiter", "Jobs", "Sourced", "Shortlisted", "Submitted", "Placements"].map(
                                (h) => (
                                  <th key={h} scope="col" className={TH}>
                                    {h}
                                  </th>
                                ),
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {recruiters.map((r) => (
                              <tr key={r.recruiter_name} className="border-b border-line last:border-0">
                                <td className={`${TD} font-medium`}>{r.recruiter_name}</td>
                                <td className={`${TD} text-ink-soft`}>{r.assigned_jobs}</td>
                                <td className={`${TD} text-ink-soft`}>{r.candidates_sourced}</td>
                                <td className={`${TD} text-ink-soft`}>{r.shortlisted}</td>
                                <td className={`${TD} text-ink-soft`}>{r.submitted}</td>
                                <td className={`${TD} font-semibold text-navy-600`}>{r.placements}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}

                  {reportType === "funnel" &&
                    (funnel.length === 0 ? (
                      <EmptyState
                        compact
                        icon={<BarChart2 size={22} aria-hidden="true" />}
                        title="No pipeline data for this period"
                        description="Try a longer date range."
                        action={
                          preset !== "all" ? (
                            <Button variant="secondary" size="sm" onClick={() => setPreset("all")}>
                              Show all time
                            </Button>
                          ) : undefined
                        }
                      />
                    ) : (
                      <ul className="space-y-2.5">
                        {funnel.map((row) => {
                          const pct =
                            totalInFunnel > 0 ? Math.round((row.count / totalInFunnel) * 100) : 0;
                          return (
                            <li key={row.stage} className="flex items-center gap-3">
                              <span className="w-24 shrink-0 truncate text-xs text-ink-soft sm:w-36">
                                {getStage(row.stage).label}
                              </span>
                              <div className="h-6 flex-1 overflow-hidden rounded-md bg-surface-sunken">
                                <div
                                  className="h-full rounded-md bg-navy-600"
                                  style={{ width: `${Math.max(pct, 3)}%` }}
                                />
                              </div>
                              <span className="w-10 shrink-0 text-right text-xs font-semibold text-ink">
                                {row.count}
                              </span>
                              <span className="w-10 shrink-0 text-right text-xs text-muted">{pct}%</span>
                            </li>
                          );
                        })}
                      </ul>
                    ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
