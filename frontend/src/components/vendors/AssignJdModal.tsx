import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, X } from "lucide-react";
import type { Vendor } from "../../types";
import { useGetJobsQuery, useUpdateJobMutation } from "../../store/api/jobApi";
import { useGetUsersQuery } from "../../store/api/adminApi";
import {
  useAssignJdMutation,
  useAssignJdRecruiterMutation,
  useSendSingleEmailMutation,
} from "../../store/api/emailApi";
import { Button, Modal, Skeleton } from "../ui";

type ApiError = { status?: number; message?: string; data?: { message?: string; code?: string } };

type Item = { id: string; [key: string]: string };

function MultiSelectList({
  items,
  selected,
  onToggle,
  labelKey,
  subLabelKey,
  label,
}: {
  items: Item[];
  selected: string[];
  onToggle: (id: string) => void;
  labelKey: string;
  subLabelKey?: string;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="max-h-44 divide-y divide-line overflow-y-auto rounded-lg border border-line"
    >
      {items.map((item) => (
        <label key={item.id} className="flex cursor-pointer select-none items-center gap-3 px-3 py-2 hover:bg-surface">
          <input
            type="checkbox"
            checked={selected.includes(item.id)}
            onChange={() => onToggle(item.id)}
            className="h-4 w-4 shrink-0 accent-navy-600"
          />
          <span className="truncate text-sm text-ink">
            {item[labelKey]}
            {subLabelKey && item[subLabelKey] && <span className="ml-1 text-muted">({item[subLabelKey]})</span>}
          </span>
        </label>
      ))}
      {items.length === 0 && <p className="px-3 py-3 text-center text-sm text-muted">None available</p>}
    </div>
  );
}

function SelectedTags({
  ids,
  items,
  labelKey,
  onRemove,
}: {
  ids: string[];
  items: Item[];
  labelKey: string;
  onRemove: (id: string) => void;
}) {
  if (ids.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const item = items.find((i) => i.id === id);
        return item ? (
          <span
            key={id}
            className="flex items-center gap-1 rounded-full bg-navy-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-navy-700 ring-1 ring-inset ring-navy-100"
          >
            {item[labelKey]}
            <button
              type="button"
              onClick={() => onRemove(id)}
              aria-label={`Remove ${item[labelKey]}`}
              className="rounded-full p-0.5 hover:bg-navy-100"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ) : null;
      })}
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

export default function AssignJdModal({
  vendors,
  userRole,
  onClose,
}: {
  vendors: Vendor[];
  userRole: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
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
  const { data: allUsers = [], isLoading: loadingRecruiters } = useGetUsersQuery(undefined, {
    skip: assignType !== "recruiter",
  });
  const recruiters = allUsers.filter((u) => u.role === "recruiter");

  // RTK Query — mutations
  const [assignJd] = useAssignJdMutation();
  const [assignJdRecruiter] = useAssignJdRecruiterMutation();
  const [updateJob] = useUpdateJobMutation();
  const [sendSingleEmail] = useSendSingleEmailMutation();

  const toggleVendor = (id: string) =>
    setSelectedVendorIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const toggleRecruiter = (id: string) =>
    setSelectedRecruiterIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

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
        } catch (recruiterAssignError) {
          const status = (recruiterAssignError as ApiError)?.status;
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
    } catch (caught) {
      const err = caught as ApiError;
      if (err?.data?.code === "EMAIL_NOT_CONFIGURED") {
        // Send the user to email settings without a full page reload.
        setSending(false);
        onClose();
        navigate(`/settings/email?returnTo=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      setError(err?.data?.message || err?.message || "Failed to send assignment email.");
    } finally {
      setSending(false);
    }
  };

  const recruiterItems = recruiters.map((r) => ({ id: r.id, full_name: r.full_name, email: r.email }));

  const vendorItems = vendors
    .filter((v) => v.is_active && v.primary_contact_email)
    .map((v) => ({ id: v.id, company_name: v.company_name }));

  const modalTitle = assignType === "recruiter" ? "Assign JD to recruiters" : "Assign JD to vendors";

  const segment = (active: boolean) =>
    `flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
      active ? "bg-white text-navy-700 shadow-sm" : "text-muted hover:text-ink"
    }`;

  return (
    <Modal
      open
      onClose={onClose}
      title={modalTitle}
      size="md"
      preventClose={sending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            {success ? "Close" : "Cancel"}
          </Button>
          <Button
            onClick={handleAssign}
            loading={sending}
            loadingText="Sending…"
            disabled={!!success}
            icon={<ClipboardList size={16} />}
          >
            Assign
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {canAssignVendor && canAssignRecruiter && (
          <div className="flex gap-1 rounded-lg bg-surface-sunken p-1" role="group" aria-label="Assign to">
            <button
              type="button"
              aria-pressed={assignType === "recruiter"}
              onClick={() => {
                setAssignType("recruiter");
                setSelectedRecruiterIds([]);
                setSelectedVendorIds([]);
              }}
              className={segment(assignType === "recruiter")}
            >
              Recruiter
            </button>
            <button
              type="button"
              aria-pressed={assignType === "vendor"}
              onClick={() => {
                setAssignType("vendor");
                setSelectedRecruiterIds([]);
                setSelectedVendorIds([]);
              }}
              className={segment(assignType === "vendor")}
            >
              Vendor
            </button>
          </div>
        )}

        <div>
          <label htmlFor="assign-jd-job" className="zh-label">
            Select JD
          </label>
          {loadingJobs ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <select
              id="assign-jd-job"
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="zh-input"
            >
              <option value="">Select a job description</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {assignType === "recruiter" && (
          <div>
            <p className="zh-label">
              Select recruiters
              {selectedRecruiterIds.length > 0 && (
                <span className="ml-2 text-xs font-normal text-navy-600">{selectedRecruiterIds.length} selected</span>
              )}
            </p>
            {loadingRecruiters ? (
              <LoadingRows />
            ) : (
              <>
                <MultiSelectList
                  label="Recruiters"
                  items={recruiterItems}
                  selected={selectedRecruiterIds}
                  onToggle={toggleRecruiter}
                  labelKey="full_name"
                  subLabelKey="email"
                />
                <SelectedTags ids={selectedRecruiterIds} items={recruiterItems} labelKey="full_name" onRemove={toggleRecruiter} />
              </>
            )}
          </div>
        )}

        {assignType === "vendor" && (
          <div>
            <p className="zh-label">
              Select vendors
              {selectedVendorIds.length > 0 && (
                <span className="ml-2 text-xs font-normal text-navy-600">{selectedVendorIds.length} selected</span>
              )}
            </p>
            <MultiSelectList
              label="Vendors"
              items={vendorItems}
              selected={selectedVendorIds}
              onToggle={toggleVendor}
              labelKey="company_name"
            />
            <SelectedTags ids={selectedVendorIds} items={vendorItems} labelKey="company_name" onRemove={toggleVendor} />
          </div>
        )}

        <div>
          <label htmlFor="assign-jd-deadline" className="zh-label">
            Deadline
          </label>
          <select
            id="assign-jd-deadline"
            value={deadlineDays}
            onChange={(e) => setDeadlineDays(Number(e.target.value))}
            className="zh-input"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>
                {d} day{d > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="rounded-lg bg-success-50 px-4 py-2.5 text-sm text-success-700">
            {success}
          </p>
        )}
      </div>
    </Modal>
  );
}
