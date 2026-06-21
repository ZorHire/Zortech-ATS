import { useState } from "react";
import {
  Plus,
  Upload,
  Search,
  Mail,
  Users,
  Award,
  CheckCircle2,
  XCircle,
  Phone,
  MapPin,
  Briefcase,
  Hash,
  Calendar,
  X,
  TrendingUp,
  Trash2,
  ClipboardList,
  Loader2,
  Pencil,
  BarChart2,
} from "lucide-react";
import BulkVendorUploadModal from "../components/bulk/BulkVendorUploadModal";
import Header from "../components/layout/Header";
import { Vendor } from "../types";
import { useSendEmail } from "../hooks/useSendEmail";
import EmailToast from "../components/ui/EmailToast";
import { useAppSelector } from "../hooks/useAppSelector";
import { selectCurrentUser } from "../store/slices/authSlice";
import {
  useGetVendorsQuery,
  useCreateVendorMutation,
  useUpdateVendorMutation,
  useDeleteVendorMutation,
  useParseVendorMutation,
  useGetVendorScorecardQuery,
} from "../store/api/vendorApi";
import { useGetJobsQuery, useUpdateJobMutation } from "../store/api/jobApi";
import { useGetUsersQuery } from "../store/api/adminApi";
import {
  useAssignJdMutation,
  useAssignJdRecruiterMutation,
  useSendSingleEmailMutation,
} from "../store/api/emailApi";

const tierConfig: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  preferred: {
    label: "Preferred",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: Award,
  },
  standard: {
    label: "Standard",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: CheckCircle2,
  },
  blocked: {
    label: "Blocked",
    color: "bg-red-100 text-red-600 border-red-200",
    icon: XCircle,
  },
};

function ScoreBar({
  value,
  max = 100,
  color,
}: {
  value: number;
  max?: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 w-8 text-right">
        {value}%
      </span>
    </div>
  );
}

function MultiSelectList({
  items,
  selected,
  onToggle,
  labelKey,
  subLabelKey,
}: {
  items: { id: string; [key: string]: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  labelKey: string;
  subLabelKey?: string;
}) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto divide-y divide-gray-50">
      {items.map((item) => (
        <label
          key={item.id}
          className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer select-none"
        >
          <input
            type="checkbox"
            checked={selected.includes(item.id)}
            onChange={() => onToggle(item.id)}
            className="accent-blue-600 w-3.5 h-3.5 flex-shrink-0"
          />
          <span className="text-sm text-gray-800 truncate">
            {item[labelKey]}
            {subLabelKey && item[subLabelKey] && (
              <span className="text-gray-400 ml-1">({item[subLabelKey]})</span>
            )}
          </span>
        </label>
      ))}
      {items.length === 0 && (
        <p className="px-3 py-3 text-sm text-gray-400 text-center">None available</p>
      )}
    </div>
  );
}

function SelectedTags({
  ids,
  items,
  labelKey,
  onRemove,
  colorClass = "bg-blue-50 text-blue-700 border-blue-100",
}: {
  ids: string[];
  items: { id: string; [key: string]: string }[];
  labelKey: string;
  onRemove: (id: string) => void;
  colorClass?: string;
}) {
  if (ids.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {ids.map((id) => {
        const item = items.find((i) => i.id === id);
        return item ? (
          <span
            key={id}
            className={`flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 text-xs rounded-full border ${colorClass}`}
          >
            {item[labelKey]}
            <button
              type="button"
              onClick={() => onRemove(id)}
              className="hover:opacity-60 transition-opacity ml-0.5"
            >
              <X size={9} />
            </button>
          </span>
        ) : null;
      })}
    </div>
  );
}

function AssignJdModal({
  vendors,
  userRole,
  onClose,
}: {
  vendors: Vendor[];
  userRole: string;
  onClose: () => void;
}) {
  const canAssignVendor = userRole === "super_admin" || userRole === "vendor_manager" || userRole === "accounts_manager";
  const canAssignRecruiter = userRole === "super_admin" || userRole === "accounts_manager";

  const [assignType, setAssignType] = useState<"recruiter" | "vendor">("vendor");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [selectedRecruiterIds, setSelectedRecruiterIds] = useState<string[]>([]);
  const [deadlineDays, setDeadlineDays] = useState(3);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // RTK Query — data
  const { data: jobs = [], isLoading: loadingJobs } = useGetJobsQuery();
  const { data: allUsers = [], isLoading: loadingRecruiters } = useGetUsersQuery(
    undefined,
    { skip: assignType !== "recruiter" },
  );
  const recruiters = allUsers.filter((u) => u.role === "recruiter");

  // RTK Query — mutations
  const [assignJd] = useAssignJdMutation();
  const [assignJdRecruiter] = useAssignJdRecruiterMutation();
  const [updateJob] = useUpdateJobMutation();
  const [sendSingleEmail] = useSendSingleEmailMutation();

  const toggleVendor = (id: string) =>
    setSelectedVendorIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );

  const toggleRecruiter = (id: string) =>
    setSelectedRecruiterIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );

  const handleAssign = async () => {
    setError("");
    setSuccess("");

    if (!selectedJobId) {
      setError("Please select a Job Description.");
      return;
    }
    if (assignType === "vendor" && selectedVendorIds.length === 0) {
      setError("Please select at least one vendor.");
      return;
    }
    if (assignType === "recruiter" && selectedRecruiterIds.length === 0) {
      setError("Please select at least one recruiter.");
      return;
    }

    setSending(true);
    try {
      if (assignType === "vendor") {
        await assignJd({
          job_id: selectedJobId,
          vendor_ids: selectedVendorIds,
          deadline_days: deadlineDays,
          site_url: window.location.origin,
        }).unwrap();
      } else {
        try {
          await assignJdRecruiter({
            job_id: selectedJobId,
            recruiter_ids: selectedRecruiterIds,
            deadline_days: deadlineDays,
            site_url: window.location.origin,
          }).unwrap();
        } catch (recruiterAssignError: any) {
          const status = recruiterAssignError?.status;
          if (status !== 404 && status !== 405) throw recruiterAssignError;

          const selectedJob = jobs.find((j) => j.id === selectedJobId);
          if (!selectedJob) throw recruiterAssignError;

          await updateJob({
            id: selectedJobId,
            body: { assigned_recruiter_ids: selectedRecruiterIds },
          }).unwrap();

          const dayLabel = deadlineDays === 1 ? "1 day" : `${deadlineDays} days`;
          await Promise.allSettled(
            selectedRecruiterIds.map((rid) => {
              const rec = recruiters.find((r) => r.id === rid);
              if (!rec) return Promise.resolve();
              return sendSingleEmail({
                to: rec.email,
                subject: `JD Assignment: ${selectedJob.title}`,
                body:
                  `Hi ${rec.full_name || rec.email},\n\n` +
                  `You have been assigned "${selectedJob.title}". Please submit candidates within ${dayLabel} at ${window.location.origin}.`,
              }).unwrap();
            }),
          );
        }
      }
      setSuccess("Assignment email(s) sent successfully.");
    } catch (err: any) {
      if (err?.data?.code === "EMAIL_NOT_CONFIGURED") {
        window.location.href = `/settings/email?returnTo=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      setError(err?.data?.message || err?.message || "Failed to send assignment email.");
    } finally {
      setSending(false);
    }
  };

  const recruiterItems = recruiters.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    email: r.email,
  }));

  const vendorItems = vendors
    .filter((v) => v.is_active && v.primary_contact_email)
    .map((v) => ({ id: v.id, company_name: v.company_name }));

  const modalTitle = assignType === "recruiter" ? "Assign JD to Recruiters" : "Assign JD to Vendors";

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">{modalTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {/* Type toggle */}
          {canAssignVendor && canAssignRecruiter && (
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
              <button
                type="button"
                onClick={() => { setAssignType("recruiter"); setSelectedRecruiterIds([]); setSelectedVendorIds([]); }}
                className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition-colors ${
                  assignType === "recruiter" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Recruiter
              </button>
              <button
                type="button"
                onClick={() => { setAssignType("vendor"); setSelectedRecruiterIds([]); setSelectedVendorIds([]); }}
                className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition-colors ${
                  assignType === "vendor" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Vendor
              </button>
            </div>
          )}

          {/* Select JD */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Select JD</label>
            {loadingJobs ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 size={14} className="animate-spin" /> Loading jobs…
              </div>
            ) : (
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
              >
                <option value="">— Select a Job Description —</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            )}
          </div>

          {/* Select Recruiters */}
          {assignType === "recruiter" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Select Recruiters
                {selectedRecruiterIds.length > 0 && (
                  <span className="ml-2 text-xs text-blue-600 font-normal">
                    {selectedRecruiterIds.length} selected
                  </span>
                )}
              </label>
              {loadingRecruiters ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                  <Loader2 size={14} className="animate-spin" /> Loading recruiters…
                </div>
              ) : (
                <>
                  <MultiSelectList
                    items={recruiterItems}
                    selected={selectedRecruiterIds}
                    onToggle={toggleRecruiter}
                    labelKey="full_name"
                    subLabelKey="email"
                  />
                  <SelectedTags
                    ids={selectedRecruiterIds}
                    items={recruiterItems}
                    labelKey="full_name"
                    onRemove={toggleRecruiter}
                    colorClass="bg-blue-50 text-blue-700 border-blue-100"
                  />
                </>
              )}
            </div>
          )}

          {/* Select Vendors */}
          {assignType === "vendor" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Select Vendors
                {selectedVendorIds.length > 0 && (
                  <span className="ml-2 text-xs text-violet-600 font-normal">
                    {selectedVendorIds.length} selected
                  </span>
                )}
              </label>
              <MultiSelectList
                items={vendorItems.map((v) => ({ id: v.id, company_name: v.company_name }))}
                selected={selectedVendorIds}
                onToggle={toggleVendor}
                labelKey="company_name"
              />
              <SelectedTags
                ids={selectedVendorIds}
                items={vendorItems.map((v) => ({ id: v.id, company_name: v.company_name }))}
                labelKey="company_name"
                onRemove={toggleVendor}
                colorClass="bg-violet-50 text-violet-700 border-violet-100"
              />
            </div>
          )}

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Deadline (days)</label>
            <select
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>
          )}
          {success && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">{success}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={sending || !!success}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {sending ? (
              <><Loader2 size={14} className="animate-spin" /> Sending…</>
            ) : (
              <><ClipboardList size={14} /> Assign</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const stageLabel: Record<string, string> = {
  new: "New", screening: "Screening", interview: "Interview",
  shortlisted: "Shortlisted", offered: "Offered", hired: "Hired", rejected: "Rejected",
};

function VendorDetailModal({
  vendor,
  onClose,
  onSendEmail,
  emailSending,
  onEdit,
}: {
  vendor: Vendor;
  onClose: () => void;
  onSendEmail: (email: string) => void;
  emailSending: boolean;
  onEdit: (v: Vendor) => void;
}) {
  const tier = tierConfig[vendor.tier];
  const TierIcon = tier.icon;
  const { data: scorecard } = useGetVendorScorecardQuery(vendor.id);

  const metrics = scorecard ?? vendor;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-white">
                {vendor.company_name.charAt(0)}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {vendor.company_name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${tier.color}`}
                >
                  <TierIcon size={11} />
                  {tier.label}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    vendor.is_active
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {vendor.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Contact info */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Contact Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Users size={15} className="text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">Primary Contact</p>
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {vendor.primary_contact_name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Mail size={15} className="text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {vendor.primary_contact_email}
                  </p>
                </div>
              </div>
              {vendor.primary_contact_phone && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <Phone size={15} className="text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">Phone</p>
                    <p className="text-sm font-medium text-gray-800">
                      {vendor.primary_contact_phone}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Calendar size={15} className="text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">Member Since</p>
                  <p className="text-sm font-medium text-gray-800">
                    {new Date(vendor.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Registration details */}
          {(vendor.registration_number || vendor.gst_id) && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Registration Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {vendor.registration_number && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <Hash size={15} className="text-gray-400 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">Registration No.</p>
                      <p className="text-sm font-medium text-gray-800">
                        {vendor.registration_number}
                      </p>
                    </div>
                  </div>
                )}
                {vendor.gst_id && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <Hash size={15} className="text-gray-400 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">GST ID</p>
                      <p className="text-sm font-medium text-gray-800">
                        {vendor.gst_id}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Performance metrics — live from scorecard when available */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <BarChart2 size={12} />
              Performance Metrics
              {scorecard && (
                <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">Live</span>
              )}
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-xl font-bold text-gray-900">{metrics.submission_count}</p>
                <p className="text-xs text-gray-400 mt-0.5">Submissions</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-xl font-bold text-gray-900">{metrics.shortlist_rate}%</p>
                <p className="text-xs text-gray-400 mt-0.5">Shortlist Rate</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-xl font-bold text-gray-900">{metrics.fill_rate}%</p>
                <p className="text-xs text-gray-400 mt-0.5">Fill Rate</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span className="flex items-center gap-1"><TrendingUp size={12} />Quality Score</span>
                  <span className="font-semibold text-gray-700">{metrics.quality_score}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${metrics.quality_score >= 80 ? "bg-emerald-500" : metrics.quality_score >= 60 ? "bg-amber-500" : "bg-red-400"}`}
                    style={{ width: `${metrics.quality_score}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span className="flex items-center gap-1"><CheckCircle2 size={12} />SLA Adherence</span>
                  <span className="font-semibold text-gray-700">{metrics.sla_adherence}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${metrics.sla_adherence >= 85 ? "bg-blue-500" : metrics.sla_adherence >= 65 ? "bg-amber-500" : "bg-red-400"}`}
                    style={{ width: `${metrics.sla_adherence}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Job breakdown — only when scorecard loaded */}
          {scorecard && scorecard.job_breakdown.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Job Breakdown
              </h3>
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {["Job", "Submitted", "Shortlisted", "Hired"].map((h) => (
                        <th key={h} className="px-3 py-2.5 font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {scorecard.job_breakdown.map((row) => (
                      <tr key={row.job_id} className="hover:bg-gray-50/60">
                        <td className="px-3 py-2.5 font-medium text-gray-800 max-w-[180px] truncate">{row.title}</td>
                        <td className="px-3 py-2.5 text-gray-600">{row.submissions}</td>
                        <td className="px-3 py-2.5 text-amber-600 font-semibold">{row.shortlisted}</td>
                        <td className="px-3 py-2.5 text-emerald-600 font-semibold">{row.hired}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent submissions */}
          {scorecard && scorecard.recent_submissions.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Recent Submissions
              </h3>
              <ol className="space-y-2">
                {scorecard.recent_submissions.map((s, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.candidate_full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{s.job_title}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {s.pipeline_stage && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {stageLabel[s.pipeline_stage] ?? s.pipeline_stage}
                        </span>
                      )}
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(s.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Specializations & Geographies */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {vendor.industry_specializations.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Briefcase size={12} />
                  Specializations
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {vendor.industry_specializations.map((spec) => (
                    <span
                      key={spec}
                      className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-100"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {vendor.geographies.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <MapPin size={12} />
                  Geographies
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {vendor.geographies.map((geo) => (
                    <span
                      key={geo}
                      className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg"
                    >
                      {geo}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSendEmail(vendor.primary_contact_email)}
              disabled={emailSending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Mail size={14} />
              {emailSending ? "Sending…" : "Send Job"}
            </button>
            <button
              onClick={() => onEdit(vendor)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Pencil size={14} />
              Edit
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function EditVendorModal({
  vendor,
  onClose,
}: {
  vendor: Vendor;
  onClose: () => void;
}) {
  const [updateVendor, { isLoading: saving }] = useUpdateVendorMutation();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    company_name: vendor.company_name,
    registration_number: vendor.registration_number ?? "",
    gst_id: vendor.gst_id ?? "",
    primary_contact_name: vendor.primary_contact_name,
    primary_contact_email: vendor.primary_contact_email,
    primary_contact_phone: vendor.primary_contact_phone ?? "",
    industry_specializations: vendor.industry_specializations.join(", "),
    geographies: vendor.geographies.join(", "),
    tier: vendor.tier as string,
    is_active: vendor.is_active,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await updateVendor({
        id: vendor.id,
        body: {
          company_name: form.company_name,
          registration_number: form.registration_number || null,
          gst_id: form.gst_id || null,
          primary_contact_name: form.primary_contact_name,
          primary_contact_email: form.primary_contact_email,
          primary_contact_phone: form.primary_contact_phone || null,
          industry_specializations: form.industry_specializations.split(",").map((s) => s.trim()).filter(Boolean),
          geographies: form.geographies.split(",").map((s) => s.trim()).filter(Boolean),
          tier: form.tier,
          is_active: form.is_active,
        },
      }).unwrap();
      onClose();
    } catch (err: any) {
      setError(err?.data?.message ?? "Failed to save changes.");
    }
  };

  const field = (label: string, key: keyof typeof form, placeholder?: string, type = "text") => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Pencil size={16} className="text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">Edit Vendor</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid gap-4 md:grid-cols-2">
            {field("Company Name", "company_name", "Staffing Agency Ltd")}
            {field("Contact Name", "primary_contact_name", "Primary Contact")}
            {field("Contact Email", "primary_contact_email", "contact@agency.com")}
            {field("Contact Phone", "primary_contact_phone", "+91-XXXXXXXXXX")}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {field("Industry Specializations", "industry_specializations", "IT staffing, healthcare")}
            {field("Geographies", "geographies", "India, UAE")}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Tier</label>
              <select
                value={form.tier}
                onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="standard">Standard</option>
                <option value="preferred">Preferred</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            {field("Registration Number", "registration_number", "123456789")}
            {field("GST ID", "gst_id", "GSTIN")}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 accent-blue-600"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Active vendor</label>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>}
        </form>

        <div className="px-6 pb-6 pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VendorsPage() {
  const user = useAppSelector(selectCurrentUser);
  const userRole: string = user?.role ?? "";
  const { sendEmail, sending: emailSending, emailToast } = useSendEmail();

  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorToEdit, setVendorToEdit] = useState<Vendor | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [showBulkVendorUpload, setShowBulkVendorUpload] = useState(false);
  const [showAssignJd, setShowAssignJd] = useState(false);
  const [vendorFile, setVendorFile] = useState<File | null>(null);
  const [vendorParseMessage, setVendorParseMessage] = useState("");
  const [vendorParseError, setVendorParseError] = useState("");
  const [vendorFormData, setVendorFormData] = useState({
    company_name: "",
    registration_number: "",
    gst_id: "",
    primary_contact_name: "",
    primary_contact_email: "",
    primary_contact_phone: "",
    industry_specializations: "",
    geographies: "",
    tier: "standard",
  });

  // RTK Query
  const { data: vendors = [], isLoading: loading } = useGetVendorsQuery();
  const [createVendor, { isLoading: formLoading }] = useCreateVendorMutation();
  const [deleteVendor] = useDeleteVendorMutation();
  const [parseVendor, { isLoading: vendorParsing }] = useParseVendorMutation();

  const resetVendorForm = () => {
    setVendorFormData({
      company_name: "",
      registration_number: "",
      gst_id: "",
      primary_contact_name: "",
      primary_contact_email: "",
      primary_contact_phone: "",
      industry_specializations: "",
      geographies: "",
      tier: "standard",
    });
    setVendorFile(null);
    setVendorParseMessage("");
    setVendorParseError("");
  };

  const parseVendorFile = async (file: File) => {
    setVendorParseMessage("");
    setVendorParseError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const parsed = await parseVendor(body).unwrap();

      setVendorFormData((current) => ({
        ...current,
        company_name: (parsed.company_name as string) || current.company_name,
        primary_contact_name:
          (parsed.primary_contact_name as string) || current.primary_contact_name,
        primary_contact_email:
          (parsed.primary_contact_email as string) || current.primary_contact_email,
        primary_contact_phone:
          (parsed.primary_contact_phone as string) || current.primary_contact_phone,
        industry_specializations:
          (parsed.industry_specializations as string[])?.length > 0
            ? (parsed.industry_specializations as string[]).join(", ")
            : current.industry_specializations,
        geographies:
          (parsed.geographies as string[])?.length > 0
            ? (parsed.geographies as string[]).join(", ")
            : current.geographies,
      }));

      setVendorParseMessage(
        "Vendor document parsed successfully. Please review the data.",
      );
    } catch (error: any) {
      setVendorParseError(
        error?.message || "Could not extract vendor data from the file.",
      );
    }
  };

  const handleAddVendor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setVendorParseError("");

    try {
      await createVendor({
        company_name: vendorFormData.company_name,
        registration_number: vendorFormData.registration_number,
        gst_id: vendorFormData.gst_id,
        primary_contact_name: vendorFormData.primary_contact_name,
        primary_contact_email: vendorFormData.primary_contact_email,
        primary_contact_phone: vendorFormData.primary_contact_phone,
        industry_specializations: vendorFormData.industry_specializations
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        geographies: vendorFormData.geographies
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        tier: vendorFormData.tier,
      }).unwrap();
      setShowAddVendor(false);
      resetVendorForm();
    } catch (error: any) {
      setVendorParseError(
        error?.message || "Failed to create vendor. Please check the form.",
      );
    }
  };

  const handleDeleteVendor = async (id: string) => {
    if (!window.confirm("Delete this vendor? This cannot be undone.")) return;
    try {
      await deleteVendor(id).unwrap();
      if (selectedVendor?.id === id) setSelectedVendor(null);
    } catch {
      alert("Failed to delete vendor");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((v) => v.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (
      !window.confirm(
        `Permanently delete ${count} vendor${count > 1 ? "s" : ""}? This cannot be undone.`,
      )
    )
      return;

    setDeleting(true);
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(
      ids.map((id) => deleteVendor(id).unwrap()),
    );
    setSelectedIds(new Set());
    setDeleting(false);

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      alert(`${failed} vendor${failed > 1 ? "s" : ""} could not be deleted.`);
    }
  };

  const filtered = vendors.filter((vendor) => {
    const matchSearch =
      vendor.company_name.toLowerCase().includes(search.toLowerCase()) ||
      vendor.primary_contact_name
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      vendor.industry_specializations.some((s) =>
        s.toLowerCase().includes(search.toLowerCase()),
      );
    const matchTier = tierFilter === "all" || vendor.tier === tierFilter;
    return matchSearch && matchTier;
  });

  const stats = {
    total: vendors.length,
    preferred: vendors.filter((v) => v.tier === "preferred").length,
    standard: vendors.filter((v) => v.tier === "standard").length,
    blocked: vendors.filter((v) => v.tier === "blocked").length,
    avgQuality:
      vendors.length > 0
        ? Math.round(
            vendors
              .filter((v) => v.is_active)
              .reduce((sum, v) => sum + (Number(v.quality_score) || 0), 0) /
              Math.max(1, vendors.filter((v) => v.is_active).length),
          )
        : 0,
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Vendor Management"
        subtitle="Manage staffing partners and track performance"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setShowAssignJd(true)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <ClipboardList size={16} />
              Assign JD
            </button>
            <button
              onClick={() => setShowBulkVendorUpload(true)}
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <Upload size={16} />
              Bulk Import
            </button>
            <button
              onClick={() => setShowAddVendor(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              Add Vendor
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Vendors", value: stats.total, color: "text-gray-900" },
            { label: "Preferred", value: stats.preferred, color: "text-emerald-600" },
            { label: "Avg Quality", value: `${stats.avgQuality}%`, color: "text-amber-600" },
            { label: "Blocked", value: stats.blocked, color: "text-red-500" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search vendors by name, contact, or specialization…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {["all", "preferred", "standard", "blocked"].map((t) => (
              <button key={t} onClick={() => setTierFilter(t)}
                className={`text-xs px-3.5 py-2.5 rounded-xl font-bold transition-all ${
                  tierFilter === t ? "bg-[#111111] text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-400"
                }`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-3">
              <input type="checkbox"
                checked={selectedIds.size === filtered.length && filtered.length > 0}
                ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filtered.length; }}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer" />
              <span className="text-sm font-semibold text-blue-700">
                {selectedIds.size} vendor{selectedIds.size > 1 ? "s" : ""} selected
              </span>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-blue-500 hover:text-blue-700 underline">Clear</button>
            </div>
            <button onClick={handleDeleteSelected} disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors">
              <Trash2 size={13} />
              {deleting ? "Deleting…" : `Delete ${selectedIds.size > 1 ? `${selectedIds.size} vendors` : "vendor"}`}
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Users size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-semibold">No vendors found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3.5 w-8">
                      <input type="checkbox"
                        checked={selectedIds.size === filtered.length && filtered.length > 0}
                        ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filtered.length; }}
                        onChange={toggleSelectAll}
                        className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600 cursor-pointer" />
                    </th>
                    {["Vendor", "Tier", "Contact", "Submissions", "Shortlist", "Fill Rate", "Quality Score", "SLA", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((vendor) => {
                    const tier = tierConfig[vendor.tier];
                    const TierIcon = tier.icon;
                    return (
                      <tr key={vendor.id} className={`hover:bg-gray-50/60 transition-colors cursor-pointer ${!vendor.is_active ? "opacity-60" : ""}`}
                        onClick={() => setSelectedVendor(vendor)}>
                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(vendor.id)} onChange={() => toggleSelect(vendor.id)}
                            className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600 cursor-pointer" />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-white">{vendor.company_name.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900 max-w-[160px] truncate">{vendor.company_name}</p>
                              <p className="text-xs text-gray-400">{vendor.is_active ? "Active" : "Inactive"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${tier.color}`}>
                            <TierIcon size={10} /> {tier.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-xs text-gray-700 font-medium">{vendor.primary_contact_name}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[140px]">{vendor.primary_contact_email}</p>
                        </td>
                        <td className="px-4 py-3.5 text-sm font-bold text-gray-900">{vendor.submission_count}</td>
                        <td className="px-4 py-3.5 text-sm font-bold text-gray-700">{vendor.shortlist_rate}%</td>
                        <td className="px-4 py-3.5 text-sm font-bold text-gray-700">{vendor.fill_rate}%</td>
                        <td className="px-4 py-3.5 min-w-[120px]">
                          <ScoreBar value={vendor.quality_score} color={vendor.quality_score >= 80 ? "bg-emerald-500" : vendor.quality_score >= 60 ? "bg-amber-500" : "bg-red-400"} />
                        </td>
                        <td className="px-4 py-3.5 min-w-[120px]">
                          <ScoreBar value={vendor.sla_adherence} color={vendor.sla_adherence >= 85 ? "bg-blue-500" : vendor.sla_adherence >= 65 ? "bg-amber-500" : "bg-red-400"} />
                        </td>
                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => sendEmail(vendor.primary_contact_email, { subject: "Job Opportunity from ZorHire" })}
                              disabled={emailSending} title="Send email"
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40">
                              <Mail size={13} />
                            </button>
                            <button onClick={() => handleDeleteVendor(vendor.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {emailToast && <EmailToast {...emailToast} />}

      {showBulkVendorUpload && (
        <BulkVendorUploadModal
          onClose={() => setShowBulkVendorUpload(false)}
          onSuccess={() => {}}
        />
      )}

      {showAssignJd && (
        <AssignJdModal
          vendors={vendors}
          userRole={userRole}
          onClose={() => setShowAssignJd(false)}
        />
      )}

      {selectedVendor && (
        <VendorDetailModal
          vendor={selectedVendor}
          onClose={() => setSelectedVendor(null)}
          onSendEmail={(email) =>
            sendEmail(email, { subject: "Job Opportunity from ZorHire" })
          }
          emailSending={emailSending}
          onEdit={(v) => { setSelectedVendor(null); setVendorToEdit(v); }}
        />
      )}

      {vendorToEdit && (
        <EditVendorModal
          vendor={vendorToEdit}
          onClose={() => setVendorToEdit(null)}
        />
      )}

      {showAddVendor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden p-6">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Add New Vendor
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Upload a file to auto-extract vendor details, then confirm the
                  form.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddVendor(false);
                  resetVendorForm();
                }}
                className="text-gray-400 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleAddVendor}
              className="space-y-4 overflow-y-auto"
              style={{ maxHeight: "calc(85vh - 5rem)" }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  {
                    label: "Company Name",
                    name: "company_name",
                    placeholder: "Staffing Agency Ltd",
                  },
                  {
                    label: "Contact Name",
                    name: "primary_contact_name",
                    placeholder: "Primary Contact",
                  },
                  {
                    label: "Contact Email",
                    name: "primary_contact_email",
                    placeholder: "contact@agency.com",
                  },
                  {
                    label: "Contact Phone",
                    name: "primary_contact_phone",
                    placeholder: "+91-XXXXXXXXXX",
                  },
                ].map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                    </label>
                    <input
                      type="text"
                      name={field.name}
                      value={
                        vendorFormData[
                          field.name as keyof typeof vendorFormData
                        ]
                      }
                      placeholder={field.placeholder}
                      onChange={(e) =>
                        setVendorFormData((current) => ({
                          ...current,
                          [e.target.name]: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Industry Specializations
                  </label>
                  <input
                    type="text"
                    value={vendorFormData.industry_specializations}
                    onChange={(e) =>
                      setVendorFormData((current) => ({
                        ...current,
                        industry_specializations: e.target.value,
                      }))
                    }
                    placeholder="e.g. IT staffing, healthcare, finance"
                    className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Comma-separated values are supported.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Geographies
                  </label>
                  <input
                    type="text"
                    value={vendorFormData.geographies}
                    onChange={(e) =>
                      setVendorFormData((current) => ({
                        ...current,
                        geographies: e.target.value,
                      }))
                    }
                    placeholder="e.g. India, UAE"
                    className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vendor Tier
                  </label>
                  <select
                    value={vendorFormData.tier}
                    onChange={(e) =>
                      setVendorFormData((current) => ({
                        ...current,
                        tier: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="standard">Standard</option>
                    <option value="preferred">Preferred</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    value={vendorFormData.registration_number}
                    onChange={(e) =>
                      setVendorFormData((current) => ({
                        ...current,
                        registration_number: e.target.value,
                      }))
                    }
                    placeholder="123456789"
                    className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    GST ID
                  </label>
                  <input
                    type="text"
                    value={vendorFormData.gst_id}
                    onChange={(e) =>
                      setVendorFormData((current) => ({
                        ...current,
                        gst_id: e.target.value,
                      }))
                    }
                    placeholder="GSTIN"
                    className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload Vendor Document
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setVendorFile(file);
                    if (file) parseVendorFile(file);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {vendorFile && (
                  <p className="text-xs text-gray-500 mt-2">
                    Selected file: {vendorFile.name}
                  </p>
                )}
              </div>

              {vendorParsing && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
                  Parsing document, please wait...
                </div>
              )}

              {vendorParseMessage && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
                  {vendorParseMessage}
                </div>
              )}

              {vendorParseError && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                  {vendorParseError}
                </div>
              )}

              <div className="flex flex-col gap-3 mt-6 md:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddVendor(false);
                    resetVendorForm();
                  }}
                  className="flex-1 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {formLoading ? "Saving..." : "Add Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
