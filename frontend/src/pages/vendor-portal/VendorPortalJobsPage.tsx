import { useState } from "react";
import VendorPortalLayout from "../../components/vendor-portal/VendorPortalLayout";
import VendorSubmitModal from "../../components/vendor-portal/VendorSubmitModal";
import { useGetVendorPortalJobsQuery } from "../../store/api/vendorPortalApi";

const PRIORITY_COLOR: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-yellow-100 text-yellow-700",
  low:      "bg-gray-100 text-gray-600",
};

const STATUS_COLOR: Record<string, string> = {
  active:   "bg-green-100 text-green-700",
  on_hold:  "bg-amber-100 text-amber-700",
};

export default function VendorPortalJobsPage() {
  const { data, isLoading, isError } = useGetVendorPortalJobsQuery();
  const [submitFor, setSubmitFor] = useState<{ id: string; title: string } | null>(null);
  const [search, setSearch] = useState("");

  const jobs = (data?.jobs ?? []).filter(
    (j) =>
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      (j.location ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (j.client_name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <VendorPortalLayout>
      {submitFor && (
        <VendorSubmitModal
          jobId={submitFor.id}
          jobTitle={submitFor.title}
          onClose={() => setSubmitFor(null)}
        />
      )}

      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Assigned Jobs</h1>
          <p className="text-gray-500 text-sm mt-1">
            Jobs your company has been assigned to source candidates for.
          </p>
        </div>

        {/* Search */}
        <div className="mb-5">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
            </svg>
            <input
              type="text"
              placeholder="Search by title, location, or client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* States */}
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="w-6 h-6 border-2 border-teal-500/20 border-t-teal-500 rounded-full animate-spin mr-3" />
            Loading jobs…
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-5 py-4 rounded-lg">
            Failed to load assigned jobs. Please try again.
          </div>
        )}

        {!isLoading && !isError && jobs.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2" />
            </svg>
            <p className="font-medium">No active jobs assigned to your company</p>
            <p className="text-sm mt-1">Check back later or contact your recruiter.</p>
          </div>
        )}

        {/* Job cards */}
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-gray-900 text-base">{job.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[job.priority] ?? "bg-gray-100 text-gray-600"}`}>
                      {job.priority}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[job.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {job.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-3 flex-wrap">
                    {job.client_name && <span>{job.client_name}</span>}
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
                      {job.mandatory_skills.slice(0, 6).map((s) => (
                        <span key={s} className="bg-teal-50 text-teal-700 text-xs px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                      {job.mandatory_skills.length > 6 && (
                        <span className="text-xs text-gray-400">+{job.mandatory_skills.length - 6} more</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  {job.my_submission_count > 0 && (
                    <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-1 rounded-lg font-medium">
                      {job.my_submission_count} submitted
                    </span>
                  )}
                  <button
                    onClick={() => setSubmitFor({ id: job.id, title: job.title })}
                    className="bg-teal-600 text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-teal-700 transition-colors"
                  >
                    Submit Candidate
                  </button>
                </div>
              </div>

              {job.sla_deadline && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    Submission deadline:{" "}
                    <span className="font-medium text-gray-600">
                      {new Date(job.sla_deadline).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric"
                      })}
                    </span>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </VendorPortalLayout>
  );
}
