import VendorPortalLayout from "../../components/vendor-portal/VendorPortalLayout";
import { useGetVendorSubmissionsQuery } from "../../store/api/vendorPortalApi";

const STAGE_LABEL: Record<string, string> = {
  new: "Received",
  sourced: "Sourced",
  screened: "Screened",
  shortlisted: "Shortlisted",
  submitted_to_client: "Sent to Client",
  client_interview_scheduled: "Interview Scheduled",
  interview_completed: "Interview Done",
  selected: "Selected",
  offer_extended: "Offer Extended",
  offer_accepted: "Offer Accepted",
  offer_rejected: "Offer Rejected",
  joined: "Joined",
  disqualified: "Disqualified",
};

const STAGE_COLOR: Record<string, string> = {
  new: "bg-gray-100 text-gray-600",
  sourced: "bg-blue-50 text-blue-600",
  screened: "bg-indigo-50 text-indigo-600",
  shortlisted: "bg-teal-50 text-teal-700",
  submitted_to_client: "bg-purple-50 text-purple-700",
  client_interview_scheduled: "bg-violet-50 text-violet-700",
  interview_completed: "bg-cyan-50 text-cyan-700",
  selected: "bg-green-100 text-green-700",
  offer_extended: "bg-emerald-50 text-emerald-700",
  offer_accepted: "bg-green-200 text-green-800",
  offer_rejected: "bg-red-50 text-red-600",
  joined: "bg-green-300 text-green-900",
  disqualified: "bg-red-100 text-red-700",
};

export default function VendorPortalSubmissionsPage() {
  const { data: submissions = [], isLoading, isError } = useGetVendorSubmissionsQuery();

  return (
    <VendorPortalLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Submissions</h1>
          <p className="text-gray-500 text-sm mt-1">
            Track all candidates you have submitted and their current status.
          </p>
        </div>

        {/* Summary strip */}
        {submissions.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total", value: submissions.length, color: "text-gray-700" },
              { label: "Under Review", value: submissions.filter((s) => ["new","sourced","screened"].includes(s.pipeline_stage ?? "")).length, color: "text-blue-600" },
              { label: "Shortlisted", value: submissions.filter((s) => ["shortlisted","submitted_to_client"].includes(s.pipeline_stage ?? "")).length, color: "text-teal-600" },
              { label: "Placed", value: submissions.filter((s) => s.pipeline_stage === "joined").length, color: "text-green-600" },
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
            <div className="w-6 h-6 border-2 border-teal-500/20 border-t-teal-500 rounded-full animate-spin mr-3" />
            Loading submissions…
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-5 py-4 rounded-lg">
            Failed to load submissions.
          </div>
        )}

        {!isLoading && !isError && submissions.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="font-medium">No submissions yet</p>
            <p className="text-sm mt-1">Go to Assigned Jobs and submit your first candidate.</p>
          </div>
        )}

        {/* Table */}
        {submissions.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Candidate</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Job</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {submissions.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.candidate_full_name}</p>
                      <p className="text-gray-500 text-xs">{s.candidate_email}</p>
                      {s.experience_years != null && (
                        <p className="text-gray-400 text-xs">{s.experience_years} yrs exp</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{s.job_title}</p>
                      {s.client_name && <p className="text-gray-500 text-xs">{s.client_name}</p>}
                      {s.job_location && <p className="text-gray-400 text-xs">{s.job_location}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {s.pipeline_stage ? (
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STAGE_COLOR[s.pipeline_stage] ?? "bg-gray-100 text-gray-600"}`}>
                          {STAGE_LABEL[s.pipeline_stage] ?? s.pipeline_stage}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Pending</span>
                      )}
                      {s.rejection_reason && (
                        <p className="text-xs text-red-500 mt-1">{s.rejection_reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(s.created_at).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric"
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </VendorPortalLayout>
  );
}
