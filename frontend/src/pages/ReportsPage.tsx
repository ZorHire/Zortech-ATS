import React from "react";
import {
  Download,
  BarChart2,
  Users,
  TrendingUp,
  Loader2,
  FileText,
} from "lucide-react";
import { useGetAnalyticsQuery } from "../store/api/analyticsApi";

type Preset = "30d" | "90d" | "6m" | "1y" | "all";
type ReportType = "placement" | "recruiter" | "funnel";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "30d", label: "Last 30 Days" },
  { key: "90d", label: "Last 90 Days" },
  { key: "6m", label: "Last 6 Months" },
  { key: "1y", label: "Last Year" },
  { key: "all", label: "All Time" },
];

const REPORT_TYPES: { key: ReportType; label: string; description: string; icon: React.ElementType }[] = [
  {
    key: "placement",
    label: "Placement Report",
    description: "Monthly placements, offer acceptance rate, and pipeline summary",
    icon: TrendingUp,
  },
  {
    key: "recruiter",
    label: "Recruiter Performance",
    description: "Jobs assigned, candidates sourced, submissions, and placements per recruiter",
    icon: Users,
  },
  {
    key: "funnel",
    label: "Hiring Funnel",
    description: "Conversion rates at each stage of the recruitment pipeline",
    icon: BarChart2,
  },
];

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  sourced: "Sourced",
  screened: "Screened",
  shortlisted: "Shortlisted",
  submitted_to_client: "Submitted",
  client_interview_scheduled: "Interview Sched.",
  interview_completed: "Interviewed",
  selected: "Selected",
  offer_extended: "Offer Extended",
  offer_accepted: "Offer Accepted",
  joined: "Joined",
};

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

export default function ReportsPage() {
  const [preset, setPreset] = React.useState<Preset>("90d");
  const [reportType, setReportType] = React.useState<ReportType>("placement");

  const dateRange = getDateRange(preset);
  const { data, isLoading } = useGetAnalyticsQuery(
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Generate and download detailed recruitment reports
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <Download size={15} />
          Download CSV
        </button>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Date preset */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Date Range</p>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  preset === p.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Report type */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Report Type</p>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {REPORT_TYPES.map((r) => (
              <button
                key={r.key}
                onClick={() => setReportType(r.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  reportType === r.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <r.icon size={13} />
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Placements", value: summary.total_placements },
            { label: "Active Jobs", value: summary.active_jobs },
            { label: "Pending Offers", value: summary.pending_offers },
            {
              label: "Offer Accept Rate",
              value:
                summary.offer_accept_rate != null
                  ? `${summary.offer_accept_rate}%`
                  : "—",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm"
            >
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Report panel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          {(() => {
            const rt = REPORT_TYPES.find((r) => r.key === reportType)!;
            return (
              <>
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                  <rt.icon size={16} className="text-gray-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{rt.label}</p>
                  <p className="text-xs text-gray-400">{rt.description}</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
                  <FileText size={13} />
                  {preset === "all"
                    ? "All time"
                    : `${dateRange.from} → ${dateRange.to}`}
                </div>
              </>
            );
          })()}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
            Generating report…
          </div>
        ) : (
          <div className="p-6">
            {/* Placement Report */}
            {reportType === "placement" && (
              <div className="space-y-6">
                {/* Monthly bar chart */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">
                    Placements by Month
                  </h3>
                  {monthly.length === 0 ? (
                    <p className="text-sm text-gray-400">No placement data for this period</p>
                  ) : (
                    <div className="flex items-end gap-3 h-36">
                      {monthly.map((m) => (
                        <div
                          key={m.label}
                          className="flex-1 flex flex-col items-center gap-1"
                        >
                          <span className="text-xs font-semibold text-gray-700">
                            {m.count}
                          </span>
                          <div
                            className="w-full bg-blue-500 rounded-t-md transition-all"
                            style={{
                              height: `${Math.max(
                                (m.count / maxMonthly) * 100,
                                4,
                              )}px`,
                            }}
                          />
                          <span className="text-xs text-gray-400">{m.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Summary table */}
                {summary && (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-50">
                      {[
                        ["Total Placements (period)", summary.total_placements],
                        ["Active Jobs (current)", summary.active_jobs],
                        ["Pending Offers (current)", summary.pending_offers],
                        [
                          "Offer Acceptance Rate",
                          summary.offer_accept_rate != null
                            ? `${summary.offer_accept_rate}%`
                            : "—",
                        ],
                        ["Candidates in Pipeline", summary.total_candidates],
                      ].map(([label, val]) => (
                        <tr key={label}>
                          <td className="py-2.5 text-gray-500 text-xs">{label}</td>
                          <td className="py-2.5 text-right font-semibold text-gray-900">
                            {val}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Recruiter Performance */}
            {reportType === "recruiter" && (
              <div>
                {recruiters.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No recruiter data for this period
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 border-b border-gray-100">
                        {[
                          "Recruiter",
                          "Jobs",
                          "Sourced",
                          "Shortlisted",
                          "Submitted",
                          "Placements",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left pb-2 px-2 font-medium"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recruiters.map((r) => (
                        <tr key={r.recruiter_name} className="hover:bg-gray-50">
                          <td className="py-3 px-2 font-medium text-gray-900">
                            {r.recruiter_name}
                          </td>
                          <td className="py-3 px-2 text-gray-500">
                            {r.assigned_jobs}
                          </td>
                          <td className="py-3 px-2 text-gray-500">
                            {r.candidates_sourced}
                          </td>
                          <td className="py-3 px-2 text-gray-500">
                            {r.shortlisted}
                          </td>
                          <td className="py-3 px-2 text-gray-500">
                            {r.submitted}
                          </td>
                          <td className="py-3 px-2">
                            <span className="font-bold text-blue-600">
                              {r.placements}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Hiring Funnel */}
            {reportType === "funnel" && (
              <div className="space-y-2.5">
                {funnel.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No pipeline data for this period
                  </p>
                ) : (
                  funnel.map((row) => {
                    const pct =
                      totalInFunnel > 0
                        ? Math.round((row.count / totalInFunnel) * 100)
                        : 0;
                    return (
                      <div key={row.stage} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-36 flex-shrink-0">
                          {STAGE_LABELS[row.stage] ?? row.stage}
                        </span>
                        <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-md flex items-center justify-end pr-2"
                            style={{ width: `${Math.max(pct, 3)}%` }}
                          >
                            <span className="text-xs font-bold text-white">
                              {row.count}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 w-10 text-right">
                          {pct}%
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
