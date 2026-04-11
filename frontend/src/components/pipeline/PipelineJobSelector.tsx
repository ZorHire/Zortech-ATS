import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Search,
  TrendingUp,
  MapPin,
  Building2,
  Users,
  Briefcase,
} from "lucide-react";
import { Job } from "../../types";
import { jobStatusLabels } from "../../lib/mockData";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-500",
  pending_review: "bg-amber-50 text-amber-700",
  active: "bg-emerald-50 text-emerald-700",
  on_hold: "bg-slate-100 text-slate-600",
  closed_filled: "bg-blue-50 text-blue-700",
  closed_cancelled: "bg-red-50 text-red-600",
  expired: "bg-red-50 text-red-600",
};

const priorityDot: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-400",
  medium: "bg-amber-400",
  low: "bg-green-500",
};

interface Props {
  jobs: Job[];
  onClose: () => void;
}

export default function PipelineJobSelector({ jobs, onClose }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        (j.client?.name || "").toLowerCase().includes(q) ||
        j.mandatory_skills.some((s) => s.toLowerCase().includes(q)),
    );
  }, [jobs, search]);

  const handleSelect = (jobId: string) => {
    setSelectedId(jobId);
    navigate(`/pipeline/${jobId}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Select a Job</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Choose which job's pipeline to view
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              autoFocus
              type="text"
              placeholder="Search by title, client or skill..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* Job list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Briefcase size={32} className="text-gray-300 mb-2" />
              <p className="text-sm font-medium text-gray-500">No jobs found</p>
              <p className="text-xs text-gray-400 mt-1">
                Try a different search term
              </p>
            </div>
          ) : (
            filtered.map((job) => (
              <button
                key={job.id}
                onClick={() => handleSelect(job.id)}
                className={`w-full text-left px-6 py-4 hover:bg-emerald-50 transition-colors group ${
                  selectedId === job.id ? "bg-emerald-50" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${priorityDot[job.priority]}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors truncate">
                        {job.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {job.client?.name && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Building2 size={11} className="text-gray-400" />
                            {job.client.name}
                          </span>
                        )}
                        {job.location && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <MapPin size={11} />
                            {job.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Users size={11} />
                          {job.application_count ?? 0} candidate
                          {(job.application_count ?? 0) !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {job.mandatory_skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {job.mandatory_skills.slice(0, 3).map((s) => (
                            <span
                              key={s}
                              className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium"
                            >
                              {s}
                            </span>
                          ))}
                          {job.mandatory_skills.length > 3 && (
                            <span className="text-xs text-gray-400">
                              +{job.mandatory_skills.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[job.status]}`}
                    >
                      {jobStatusLabels[job.status]}
                    </span>
                    <TrendingUp
                      size={14}
                      className="text-gray-300 group-hover:text-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex-shrink-0 bg-gray-50/50">
          <p className="text-xs text-gray-400 text-center">
            {filtered.length} of {jobs.length} job
            {jobs.length !== 1 ? "s" : ""} shown
          </p>
        </div>
      </div>
    </div>
  );
}
