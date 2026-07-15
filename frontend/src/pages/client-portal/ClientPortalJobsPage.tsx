import { useNavigate } from "react-router-dom";
import ClientPortalLayout from "../../components/client-portal/ClientPortalLayout";
import { useGetClientPortalJobsQuery } from "../../store/api/clientPortalApi";

const STATUS_COLOR: Record<string, string> = {
  active:   "bg-green-100 text-green-700",
  on_hold:  "bg-amber-100 text-amber-700",
  draft:    "bg-gray-100 text-gray-600",
  closed_filled: "bg-blue-100 text-blue-700",
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-yellow-100 text-yellow-700",
  low:      "bg-gray-100 text-gray-600",
};

export default function ClientPortalJobsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useGetClientPortalJobsQuery();

  const jobs = data?.jobs ?? [];

  return (
    <ClientPortalLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Open Positions</h1>
          <p className="text-gray-500 text-sm mt-1">
            Review candidates submitted for your open roles and share your feedback.
          </p>
        </div>

        {/* Summary strip */}
        {jobs.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Active Jobs", value: jobs.filter((j) => j.status === "active").length, color: "text-indigo-600" },
              { label: "Pending Review", value: jobs.reduce((sum, j) => sum + Number(j.pending_review_count), 0), color: "text-amber-600" },
              { label: "Reviewed", value: jobs.reduce((sum, j) => sum + Number(j.reviewed_count), 0), color: "text-green-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm text-center">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* States */}
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mr-3" />
            Loading positions…
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-5 py-4 rounded-lg">
            Failed to load positions. Please try again.
          </div>
        )}

        {!isLoading && !isError && jobs.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-medium">No positions shared yet</p>
            <p className="text-sm mt-1">Your recruitment team will share open roles here.</p>
          </div>
        )}

        {/* Job cards */}
        <div className="space-y-4">
          {jobs.map((job) => {
            const pending = Number(job.pending_review_count);
            return (
              <div
                key={job.id}
                onClick={() => navigate(`/client-portal/jobs/${job.id}/candidates`)}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-gray-900 text-base group-hover:text-indigo-700 transition-colors">
                        {job.title}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[job.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {job.status.replace(/_/g, " ")}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[job.priority] ?? "bg-gray-100 text-gray-600"}`}>
                        {job.priority}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3 flex-wrap">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          {job.location}
                        </span>
                      )}
                      <span>{job.experience_min}–{job.experience_max} yrs</span>
                      <span>{job.work_mode.replace("_", " ")}</span>
                      <span>{job.headcount} opening{job.headcount !== 1 ? "s" : ""}</span>
                    </div>

                    {job.mandatory_skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {job.mandatory_skills.slice(0, 5).map((s) => (
                          <span key={s} className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full">{s}</span>
                        ))}
                        {job.mandatory_skills.length > 5 && (
                          <span className="text-xs text-gray-400">+{job.mandatory_skills.length - 5} more</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    {pending > 0 && (
                      <span className="text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">
                        {pending} awaiting review
                      </span>
                    )}
                    {Number(job.reviewed_count) > 0 && (
                      <span className="text-xs text-gray-400">
                        {job.reviewed_count} reviewed
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-indigo-500 text-sm font-medium group-hover:text-indigo-700">
                      View candidates
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ClientPortalLayout>
  );
}
