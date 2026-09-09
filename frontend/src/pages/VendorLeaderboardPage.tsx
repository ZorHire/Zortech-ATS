import { useNavigate } from "react-router-dom";
import {
  Trophy,
  ArrowLeft,
  TrendingUp,
  CheckCircle2,
  Award,
  XCircle,
  Users,
} from "lucide-react";
import Header from "../components/layout/Header";
import { useGetVendorLeaderboardQuery } from "../store/api/vendorApi";

const tierConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  preferred: { label: "Preferred", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: Award },
  standard: { label: "Standard", color: "bg-blue-50 text-blue-700 border-blue-200", icon: CheckCircle2 },
  blocked: { label: "Blocked", color: "bg-red-100 text-red-600 border-red-200", icon: XCircle },
};

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-8 text-right">{value}%</span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center shadow-sm">
        <Trophy size={15} className="text-white" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center shadow-sm">
        <span className="text-xs font-black text-gray-700">2</span>
      </div>
    );
  if (rank === 3)
    return (
      <div className="w-8 h-8 rounded-full bg-amber-600/70 flex items-center justify-center shadow-sm">
        <span className="text-xs font-black text-white">3</span>
      </div>
    );
  return (
    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
      <span className="text-xs font-bold text-gray-500">{rank}</span>
    </div>
  );
}

export default function VendorLeaderboardPage() {
  const navigate = useNavigate();
  const { data: entries = [], isLoading } = useGetVendorLeaderboardQuery();

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  const statCards = [
    { label: "Total Vendors", value: entries.length, color: "text-gray-900" },
    {
      label: "Avg Quality",
      value: entries.length
        ? `${Math.round(entries.reduce((s, e) => s + Number(e.quality_score || 0), 0) / entries.length)}%`
        : "—",
      color: "text-amber-600",
    },
    {
      label: "Preferred",
      value: entries.filter((e) => e.tier === "preferred").length,
      color: "text-emerald-600",
    },
    {
      label: "Active",
      value: entries.filter((e) => e.is_active).length,
      color: "text-blue-600",
    },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Vendor Leaderboard"
        subtitle="Ranked by quality score — shortlist rate, fill rate, and SLA adherence"
        actions={
          <button
            onClick={() => navigate("/vendors")}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={15} />
            Back to Vendors
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <Users size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-semibold">No vendor data yet</p>
            <p className="text-sm text-gray-400 mt-1">Vendor metrics appear once submissions are made.</p>
          </div>
        ) : (
          <>
            {/* Top 3 podium cards */}
            {top3.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {top3.map((entry) => {
                  const tier = tierConfig[entry.tier] ?? tierConfig.standard;
                  const TierIcon = tier.icon;
                  const scoreColor =
                    entry.quality_score >= 80
                      ? "bg-emerald-500"
                      : entry.quality_score >= 60
                      ? "bg-amber-500"
                      : "bg-red-400";
                  return (
                    <div
                      key={entry.id}
                      className={`relative bg-white rounded-2xl border shadow-sm p-5 ${
                        entry.rank === 1 ? "border-amber-300 ring-2 ring-amber-200" : "border-gray-100"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <RankBadge rank={entry.rank} />
                        <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${tier.color}`}>
                          <TierIcon size={10} />
                          {tier.label}
                        </span>
                      </div>
                      <div className="mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center mb-2">
                          <span className="text-sm font-bold text-white">{entry.company_name.charAt(0)}</span>
                        </div>
                        <p className="font-bold text-gray-900 text-sm">{entry.company_name}</p>
                        <p className="text-xs text-gray-400">{entry.submission_count} submissions</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span className="flex items-center gap-1"><TrendingUp size={11} />Quality</span>
                          <span className="font-bold text-gray-800">{entry.quality_score}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${scoreColor}`} style={{ width: `${entry.quality_score}%` }} />
                        </div>
                        <div className="grid grid-cols-3 gap-1 pt-1">
                          {[
                            { label: "Shortlist", value: entry.shortlist_rate },
                            { label: "Fill", value: entry.fill_rate },
                            { label: "SLA", value: entry.sla_adherence },
                          ].map((m) => (
                            <div key={m.label} className="text-center p-1.5 bg-gray-50 rounded-lg">
                              <p className="text-xs font-bold text-gray-800">{m.value}%</p>
                              <p className="text-[9px] text-gray-400">{m.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full table for rank 4+ */}
            {rest.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {["Rank", "Vendor", "Tier", "Submissions", "Shortlist", "Fill Rate", "SLA", "Quality Score"].map((h) => (
                          <th key={h} className="px-4 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rest.map((entry) => {
                        const tier = tierConfig[entry.tier] ?? tierConfig.standard;
                        const TierIcon = tier.icon;
                        const scoreColor =
                          entry.quality_score >= 80
                            ? "bg-emerald-500"
                            : entry.quality_score >= 60
                            ? "bg-amber-500"
                            : "bg-red-400";
                        return (
                          <tr key={entry.id} className={`hover:bg-gray-50/60 transition-colors ${!entry.is_active ? "opacity-60" : ""}`}>
                            <td className="px-4 py-3.5">
                              <RankBadge rank={entry.rank} />
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-bold text-white">{entry.company_name.charAt(0)}</span>
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{entry.company_name}</p>
                                  <p className="text-xs text-gray-400">{entry.is_active ? "Active" : "Inactive"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${tier.color}`}>
                                <TierIcon size={10} /> {tier.label}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-sm font-bold text-gray-900">{entry.submission_count}</td>
                            <td className="px-4 py-3.5">
                              <ScoreBar value={entry.shortlist_rate} color="bg-amber-400" />
                            </td>
                            <td className="px-4 py-3.5">
                              <ScoreBar value={entry.fill_rate} color="bg-blue-400" />
                            </td>
                            <td className="px-4 py-3.5">
                              <ScoreBar value={entry.sla_adherence} color="bg-violet-400" />
                            </td>
                            <td className="px-4 py-3.5">
                              <ScoreBar value={entry.quality_score} color={scoreColor} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
