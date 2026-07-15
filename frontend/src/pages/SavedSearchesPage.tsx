import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bookmark,
  Search,
  Trash2,
  Play,
  Bell,
  BellOff,
  Loader2,
  AlertCircle,
} from "lucide-react";
import Header from "../components/layout/Header";
import {
  useGetSavedSearchesQuery,
  useDeleteSavedSearchMutation,
  type SavedSearch,
} from "../store/api/savedSearchesApi";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildSearchUrl(query: Record<string, unknown>) {
  const params = new URLSearchParams();
  if (query.q && typeof query.q === "string") params.set("q", query.q);
  if (query.skills && Array.isArray(query.skills))
    params.set("skills", (query.skills as string[]).join(","));
  if (query.location && typeof query.location === "string")
    params.set("location", query.location);
  if (query.min_experience !== undefined)
    params.set("min_experience", String(query.min_experience));
  if (query.max_experience !== undefined)
    params.set("max_experience", String(query.max_experience));
  const qs = params.toString();
  return `/search${qs ? `?${qs}` : ""}`;
}

function summarizeQuery(query: Record<string, unknown>): string {
  const parts: string[] = [];
  if (query.q) parts.push(`"${query.q}"`);
  if (Array.isArray(query.skills) && query.skills.length)
    parts.push(`Skills: ${(query.skills as string[]).join(", ")}`);
  if (query.location) parts.push(`Location: ${query.location}`);
  if (query.min_experience != null || query.max_experience != null) {
    const min = query.min_experience ?? 0;
    const max = query.max_experience;
    parts.push(max ? `Exp: ${min}–${max} yrs` : `Exp: ${min}+ yrs`);
  }
  return parts.join(" · ") || "No filters";
}

export default function SavedSearchesPage() {
  const navigate = useNavigate();
  const { data: searches = [], isLoading, isError, refetch } =
    useGetSavedSearchesQuery();
  const [deleteSearch, { isLoading: isDeleting }] = useDeleteSavedSearchMutation();

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const filtered = searches.filter((s) =>
    !searchFilter || s.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    try {
      await deleteSearch(id).unwrap();
      setConfirmDeleteId(null);
      showToast("Saved search deleted");
    } catch {
      showToast("Failed to delete", "error");
    }
  };

  const handleRun = (s: SavedSearch) => {
    navigate(buildSearchUrl(s.query));
  };

  return (
    <div className="min-h-screen bg-[#f8f6f2]">
      <Header title="Saved Searches" />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            {
              label: "Total Saved",
              value: searches.length,
              icon: Bookmark,
              color: "text-blue-600 bg-blue-50",
            },
            {
              label: "Email Alerts On",
              value: searches.filter((s) => s.email_alerts).length,
              icon: Bell,
              color: "text-amber-600 bg-amber-50",
            },
            {
              label: "No Alerts",
              value: searches.filter((s) => !s.email_alerts).length,
              icon: BellOff,
              color: "text-gray-500 bg-gray-100",
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}
              >
                <Icon size={18} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-2xl font-black text-[#111111]">{value}</p>
                <p className="text-xs text-gray-400 font-semibold">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search filter + CTA */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Filter by name..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
          <button
            onClick={() => navigate("/search")}
            className="flex items-center gap-2 bg-[#111111] text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-[#333] transition-all shadow-sm flex-shrink-0"
          >
            <Search size={15} />
            New Search
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={32} className="animate-spin text-gray-300" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-24 text-gray-400">
            <AlertCircle size={32} />
            <p className="text-sm font-medium">Failed to load saved searches</p>
            <button
              onClick={() => refetch()}
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-gray-400">
            <Bookmark size={40} strokeWidth={1.5} />
            <p className="text-sm font-medium">
              {searches.length === 0
                ? "No saved searches yet"
                : "No searches match your filter"}
            </p>
            {searches.length === 0 && (
              <button
                onClick={() => navigate("/search")}
                className="text-xs text-blue-600 hover:underline font-semibold"
              >
                Go to Resume Search to save one
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5 flex items-center gap-4"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Bookmark size={16} className="text-blue-600" strokeWidth={2.5} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-[#111111] truncate">
                      {s.name}
                    </h3>
                    {s.email_alerts ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-full font-bold">
                        <Bell size={9} />
                        Alerts on
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-gray-100 text-gray-400 border border-gray-200 rounded-full font-bold">
                        <BellOff size={9} />
                        No alerts
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {summarizeQuery(s.query)}
                  </p>
                  <p className="text-[10px] text-gray-300 mt-1">
                    Saved {fmtDate(s.created_at)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleRun(s)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#111111] bg-[#111111]/5 hover:bg-[#111111] hover:text-white rounded-xl transition-all"
                  >
                    <Play size={12} />
                    Run
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(s.id)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-5">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <h3 className="text-base font-black text-[#111111] mb-2">
              Delete Saved Search?
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              This will permanently remove this saved search and any associated
              email alerts.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-3 bg-gray-50 text-[#111111] font-bold text-sm rounded-xl border border-gray-100 hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-500 text-white font-bold text-sm rounded-xl hover:bg-red-600 transition-all disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] px-5 py-3.5 rounded-2xl text-sm font-bold shadow-xl transition-all animate-in slide-in-from-bottom-4 ${
            toast.type === "error"
              ? "bg-red-500 text-white"
              : "bg-[#111111] text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
