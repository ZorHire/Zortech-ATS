import React from "react";
import {
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Loader2,
  ExternalLink,
  Briefcase,
  MapPin,
  IndianRupee,
} from "lucide-react";
import {
  useGetOfferStatsQuery,
  useGetOffersQuery,
  useGetPlacementsQuery,
  type OfferRecord,
  type PlacementRecord,
} from "../store/api/offersApi";
import { Link } from "react-router-dom";

type MainTab = "offers" | "placements";
type OfferFilter = "all" | "offer_extended" | "offer_accepted" | "offer_rejected";

const STAGE_COLORS: Record<string, string> = {
  offer_extended: "bg-blue-50 text-blue-700 border-blue-100",
  offer_accepted: "bg-emerald-50 text-emerald-700 border-emerald-100",
  offer_rejected: "bg-red-50 text-red-600 border-red-100",
  joined: "bg-purple-50 text-purple-700 border-purple-100",
};

const STAGE_LABELS: Record<string, string> = {
  offer_extended: "Pending",
  offer_accepted: "Accepted",
  offer_rejected: "Declined",
  joined: "Joined",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCTC(val: number | null) {
  if (val == null) return "—";
  return `₹${(val / 100000).toFixed(1)}L`;
}

function daysSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function OfferRow({ row }: { row: OfferRecord }) {
  const days = daysSince(row.stage_updated_at);
  return (
    <tr className="hover:bg-gray-50/50 transition-colors">
      <td className="px-5 py-3.5">
        <p className="font-medium text-gray-900">
          {row.first_name} {row.last_name}
        </p>
        <p className="text-xs text-gray-400">{row.candidate_email}</p>
        {row.current_title && (
          <p className="text-xs text-gray-400 mt-0.5">{row.current_title}</p>
        )}
      </td>
      <td className="px-5 py-3.5">
        <p className="font-medium text-gray-800">{row.job_title}</p>
        {row.job_location && (
          <span className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
            <MapPin size={11} />
            {row.job_location}
          </span>
        )}
      </td>
      <td className="px-5 py-3.5 text-gray-600 text-sm">
        {row.client_name || <span className="text-gray-300">—</span>}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex gap-3 text-xs text-gray-600">
          <span title="Current CTC" className="flex items-center gap-0.5">
            <IndianRupee size={11} className="text-gray-400" />
            {formatCTC(row.current_ctc)}
          </span>
          <span className="text-gray-300">→</span>
          <span title="Expected CTC" className="flex items-center gap-0.5 text-emerald-700 font-medium">
            <IndianRupee size={11} />
            {formatCTC(row.expected_ctc)}
          </span>
        </div>
      </td>
      <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">
        {formatDate(row.stage_updated_at)}
        <p className="text-xs text-gray-400 mt-0.5">{days}d ago</p>
      </td>
      <td className="px-5 py-3.5">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${STAGE_COLORS[row.stage]}`}
        >
          {STAGE_LABELS[row.stage]}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <Link
          to={`/jobs/${row.job_id}`}
          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          <ExternalLink size={12} />
          Pipeline
        </Link>
      </td>
    </tr>
  );
}

function PlacementRow({ row }: { row: PlacementRecord }) {
  return (
    <tr className="hover:bg-gray-50/50 transition-colors">
      <td className="px-5 py-3.5">
        <p className="font-medium text-gray-900">
          {row.first_name} {row.last_name}
        </p>
        <p className="text-xs text-gray-400">{row.candidate_email}</p>
        {row.current_title && (
          <p className="text-xs text-gray-400 mt-0.5">{row.current_title}</p>
        )}
      </td>
      <td className="px-5 py-3.5">
        <p className="font-medium text-gray-800">{row.job_title}</p>
        {row.job_location && (
          <span className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
            <MapPin size={11} />
            {row.job_location}
          </span>
        )}
      </td>
      <td className="px-5 py-3.5 text-gray-600 text-sm">
        {row.client_name || <span className="text-gray-300">—</span>}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex gap-3 text-xs text-gray-600">
          <span title="Current CTC" className="flex items-center gap-0.5">
            <IndianRupee size={11} className="text-gray-400" />
            {formatCTC(row.current_ctc)}
          </span>
          <span className="text-gray-300">→</span>
          <span title="Expected CTC" className="flex items-center gap-0.5 text-emerald-700 font-medium">
            <IndianRupee size={11} />
            {formatCTC(row.expected_ctc)}
          </span>
        </div>
      </td>
      <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">
        {formatDate(row.placement_date)}
      </td>
      <td className="px-5 py-3.5">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${STAGE_COLORS[row.stage]}`}
        >
          {row.stage === "joined" ? "Joined" : "Accepted"}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <Link
          to={`/jobs/${row.job_id}`}
          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          <ExternalLink size={12} />
          Pipeline
        </Link>
      </td>
    </tr>
  );
}

export default function OffersPage() {
  const [mainTab, setMainTab] = React.useState<MainTab>("offers");
  const [offerFilter, setOfferFilter] = React.useState<OfferFilter>("all");

  const { data: stats, isLoading: statsLoading } = useGetOfferStatsQuery();
  const { data: offers = [], isLoading: offersLoading } = useGetOffersQuery();
  const { data: placements = [], isLoading: placementsLoading } = useGetPlacementsQuery();

  const filteredOffers =
    offerFilter === "all"
      ? offers
      : offers.filter((o) => o.stage === offerFilter);

  const OFFER_FILTER_TABS: { key: OfferFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "offer_extended", label: "Pending" },
    { key: "offer_accepted", label: "Accepted" },
    { key: "offer_rejected", label: "Declined" },
  ];

  const TABLE_HEADERS = [
    "Candidate",
    "Job",
    "Client",
    "CTC",
    "Date",
    "Status",
    "",
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Offers & Placements</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Track offer letters and successful placements across all jobs
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={15} className="text-blue-500" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending</p>
          </div>
          <p className="text-3xl font-bold text-blue-600">
            {statsLoading ? "—" : (stats?.pending ?? 0)}
          </p>
          <p className="text-xs text-gray-400 mt-1">awaiting response</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={15} className="text-emerald-500" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Accepted</p>
          </div>
          <p className="text-3xl font-bold text-emerald-600">
            {statsLoading ? "—" : (stats?.accepted ?? 0)}
          </p>
          <p className="text-xs text-gray-400 mt-1">offers accepted</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <XCircle size={15} className="text-red-400" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Declined</p>
          </div>
          <p className="text-3xl font-bold text-red-500">
            {statsLoading ? "—" : (stats?.declined ?? 0)}
          </p>
          <p className="text-xs text-gray-400 mt-1">offers declined</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={15} className="text-purple-500" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Placements</p>
          </div>
          <p className="text-3xl font-bold text-purple-600">
            {statsLoading ? "—" : (stats?.placements ?? 0)}
          </p>
          <p className="text-xs text-gray-400 mt-1">candidates joined</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["offers", "placements"] as MainTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              mainTab === tab
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "offers" ? (
              <span className="flex items-center gap-2">
                <Briefcase size={14} />
                Offers
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Users size={14} />
                Placements
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Offers Panel */}
      {mainTab === "offers" && (
        <>
          {/* Stage filter sub-tabs */}
          <div className="flex gap-2">
            {OFFER_FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setOfferFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  offerFilter === tab.key
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 opacity-60">
                  {tab.key === "all"
                    ? offers.length
                    : offers.filter((o) => o.stage === tab.key).length}
                </span>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {offersLoading ? (
              <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
                <Loader2 size={20} className="animate-spin" />
                Loading offers…
              </div>
            ) : filteredOffers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-gray-400">
                <Briefcase size={32} className="opacity-40" />
                <p className="text-sm">No offers in this view</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {TABLE_HEADERS.map((h, i) => (
                      <th
                        key={i}
                        className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredOffers.map((row) => (
                    <OfferRow key={row.application_id} row={row} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Placements Panel */}
      {mainTab === "placements" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {placementsLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
              Loading placements…
            </div>
          ) : placements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-gray-400">
              <Users size={32} className="opacity-40" />
              <p className="text-sm">No placements yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {TABLE_HEADERS.map((h, i) => (
                    <th
                      key={i}
                      className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {placements.map((row) => (
                  <PlacementRow key={row.application_id} row={row} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
