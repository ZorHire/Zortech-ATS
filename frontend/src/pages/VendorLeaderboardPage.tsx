import { useNavigate } from "react-router-dom";
import { Trophy, ArrowLeft, TrendingUp, Users, Award, Gauge, CheckCircle2 } from "lucide-react";
import { useGetVendorLeaderboardQuery } from "../store/api/vendorApi";
import { Button, PageHeader, StatCard, EmptyState, ErrorState, CardGridSkeleton, TableSkeleton } from "../components/ui";
import { ScoreBar, TierBadge, VendorAvatar, qualityColor } from "../components/vendors/vendorUi";

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-ink shadow-sm" aria-label="Rank 1">
        <Trophy size={15} aria-hidden="true" />
      </div>
    );
  const cls =
    rank === 2
      ? "bg-navy-100 text-navy-700"
      : rank === 3
        ? "bg-brand-100 text-brand-800"
        : "bg-surface-sunken text-muted";
  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${cls}`} aria-label={`Rank ${rank}`}>
      {rank}
    </div>
  );
}

export default function VendorLeaderboardPage() {
  const navigate = useNavigate();
  const { data: entries = [], isLoading, isError, error, refetch, isFetching } = useGetVendorLeaderboardQuery();

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  const avgQuality = entries.length
    ? `${Math.round(entries.reduce((s, e) => s + Number(e.quality_score || 0), 0) / entries.length)}%`
    : "—";

  return (
    <>
      <PageHeader
        title="Vendor leaderboard"
        subtitle="Ranked by quality score: shortlist rate, fill rate and SLA adherence"
        breadcrumbs={[{ label: "Vendors", to: "/vendors" }, { label: "Leaderboard" }]}
        actions={
          <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => navigate("/vendors")}>
            Back to vendors
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard label="Total vendors" value={entries.length} icon={<Users size={18} />} loading={isLoading} />
          <StatCard label="Avg quality" value={avgQuality} icon={<Gauge size={18} />} tone="brand" loading={isLoading} />
          <StatCard
            label="Preferred"
            value={entries.filter((e) => e.tier === "preferred").length}
            icon={<Award size={18} />}
            tone="success"
            loading={isLoading}
          />
          <StatCard
            label="Active"
            value={entries.filter((e) => e.is_active).length}
            icon={<CheckCircle2 size={18} />}
            loading={isLoading}
          />
        </div>

        {isLoading ? (
          <>
            <CardGridSkeleton count={3} />
            <TableSkeleton />
          </>
        ) : isError ? (
          <div className="zh-card">
            <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
          </div>
        ) : entries.length === 0 ? (
          <div className="zh-card">
            <EmptyState
              icon={<Users size={22} aria-hidden="true" />}
              title="No vendor data yet"
              description="Vendor metrics appear once submissions are made."
            />
          </div>
        ) : (
          <>
            {top3.length > 0 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {top3.map((entry) => (
                  <div
                    key={entry.id}
                    className={`zh-card p-5 ${entry.rank === 1 ? "border-brand-300 ring-2 ring-brand-100" : ""}`}
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <RankBadge rank={entry.rank} />
                      <TierBadge tier={entry.tier} />
                    </div>
                    <div className="mb-4 flex items-center gap-3">
                      <VendorAvatar name={entry.company_name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{entry.company_name}</p>
                        <p className="text-xs text-muted">{entry.submission_count} submissions</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <TrendingUp size={12} aria-hidden="true" />
                          Quality
                        </span>
                        <span className="font-semibold text-ink">{entry.quality_score}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                        <div
                          className={`h-full rounded-full ${qualityColor(entry.quality_score)}`}
                          style={{ width: `${Math.min(100, Math.max(0, entry.quality_score))}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        {[
                          { label: "Shortlist", value: entry.shortlist_rate },
                          { label: "Fill", value: entry.fill_rate },
                          { label: "SLA", value: entry.sla_adherence },
                        ].map((m) => (
                          <div key={m.label} className="rounded-lg bg-surface p-1.5 text-center">
                            <p className="text-xs font-semibold text-ink">{m.value}%</p>
                            <p className="text-xs text-muted">{m.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rest.length > 0 && (
              <div className="zh-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                    <caption className="sr-only">Vendors ranked 4 and below</caption>
                    <thead className="bg-surface">
                      <tr>
                        {["Rank", "Vendor", "Tier", "Submissions", "Shortlist", "Fill rate", "SLA", "Quality score"].map((h) => (
                          <th
                            key={h}
                            scope="col"
                            className="whitespace-nowrap border-b border-line px-4 py-2.5 text-xs font-medium text-muted"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rest.map((entry) => (
                        <tr
                          key={entry.id}
                          className={`border-b border-line last:border-0 hover:bg-surface ${!entry.is_active ? "opacity-60" : ""}`}
                        >
                          <td className="px-4 py-3">
                            <RankBadge rank={entry.rank} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <VendorAvatar name={entry.company_name} size="sm" />
                              <div className="min-w-0">
                                <p className="max-w-[200px] truncate font-medium text-ink">{entry.company_name}</p>
                                <p className="text-xs text-muted">{entry.is_active ? "Active" : "Inactive"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <TierBadge tier={entry.tier} />
                          </td>
                          <td className="px-4 py-3 font-semibold text-ink">{entry.submission_count}</td>
                          <td className="px-4 py-3">
                            <ScoreBar value={entry.shortlist_rate} color="bg-brand-400" />
                          </td>
                          <td className="px-4 py-3">
                            <ScoreBar value={entry.fill_rate} color="bg-navy-400" />
                          </td>
                          <td className="px-4 py-3">
                            <ScoreBar value={entry.sla_adherence} color="bg-navy-600" />
                          </td>
                          <td className="px-4 py-3">
                            <ScoreBar value={entry.quality_score} color={qualityColor(entry.quality_score)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
