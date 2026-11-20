import { useState } from "react";
import type { ReactNode } from "react";
import {
  Users,
  Mail,
  Phone,
  Calendar,
  Hash,
  BarChart2,
  TrendingUp,
  CheckCircle2,
  Star,
  FileText,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Briefcase,
  MapPin,
} from "lucide-react";
import type { Vendor } from "../../types";
import {
  useGetVendorScorecardQuery,
  useListVendorContractsQuery,
  useCreateVendorContractMutation,
  useUpdateVendorContractMutation,
  useDeleteVendorContractMutation,
  useAddSubmissionFeedbackMutation,
} from "../../store/api/vendorApi";
import type { VendorContract } from "../../store/api/vendorApi";
import { Badge, Button, Modal, StageBadge, useConfirm } from "../ui";
import type { BadgeTone } from "../ui";
import { useNotify } from "../../hooks/useNotify";
import { TierBadge, VendorAvatar, qualityColor, slaColor } from "./vendorUi";

function SectionTitle({ icon, children, extra }: { icon?: ReactNode; children: ReactNode; extra?: ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
      {icon}
      {children}
      {extra}
    </h3>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface p-3">
      <span className="shrink-0 text-muted">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="truncate text-sm font-medium text-ink">{value}</p>
      </div>
    </div>
  );
}

const contractTone: Record<string, BadgeTone> = {
  active: "success",
  draft: "neutral",
  expired: "warning",
  terminated: "danger",
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function VendorDetailModal({
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
  const confirm = useConfirm();
  const notify = useNotify();
  const { data: scorecard } = useGetVendorScorecardQuery(vendor.id);
  const metrics = scorecard ?? vendor;

  const [addSubmissionFeedback] = useAddSubmissionFeedbackMutation();
  const { data: contracts = [] } = useListVendorContractsQuery(vendor.id);
  const [createVendorContract, { isLoading: contractCreating }] = useCreateVendorContractMutation();
  const [updateVendorContract] = useUpdateVendorContractMutation();
  const [deleteVendorContract] = useDeleteVendorContractMutation();

  const emptyContractForm = { title: "", contract_type: "msa", start_date: "", end_date: "", status: "active", value: "", notes: "" };
  const [showContractForm, setShowContractForm] = useState(false);
  const [editingContract, setEditingContract] = useState<VendorContract | null>(null);
  const [contractForm, setContractForm] = useState(emptyContractForm);
  const [contractError, setContractError] = useState("");
  const [localFeedback, setLocalFeedback] = useState<Record<string, { rating: number | null; notes: string; saving: boolean }>>({});

  const handleSaveContract = async () => {
    setContractError("");
    if (!contractForm.title || !contractForm.start_date) {
      setContractError("Title and start date are required.");
      return;
    }
    try {
      const body = {
        title: contractForm.title,
        contract_type: contractForm.contract_type,
        start_date: contractForm.start_date,
        end_date: contractForm.end_date || null,
        status: contractForm.status,
        value: contractForm.value ? Number(contractForm.value) : null,
        notes: contractForm.notes || null,
      };
      if (editingContract) {
        await updateVendorContract({ vendorId: vendor.id, contractId: editingContract.id, body }).unwrap();
      } else {
        await createVendorContract({ vendorId: vendor.id, body }).unwrap();
      }
      setShowContractForm(false);
      setEditingContract(null);
      setContractForm(emptyContractForm);
    } catch {
      setContractError("Failed to save contract.");
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    if (!(await confirm({ title: "Delete this contract?", message: "This cannot be undone.", danger: true, confirmText: "Delete" })))
      return;
    try {
      await deleteVendorContract({ vendorId: vendor.id, contractId }).unwrap();
    } catch {
      notify.error("Failed to delete contract.");
    }
  };

  const handleSaveFeedback = async (submissionId: string) => {
    const fb = localFeedback[submissionId];
    if (!fb) return;
    setLocalFeedback((prev) => ({ ...prev, [submissionId]: { ...fb, saving: true } }));
    try {
      await addSubmissionFeedback({
        vendorId: vendor.id,
        submissionId,
        body: { recruiter_rating: fb.rating, recruiter_notes: fb.notes || null },
      }).unwrap();
    } catch {
      notify.error("Failed to save feedback.");
    }
    setLocalFeedback((prev) => ({ ...prev, [submissionId]: { ...prev[submissionId], saving: false } }));
  };

  const setCF = (key: keyof typeof emptyContractForm, value: string) => setContractForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      closeOnBackdrop={!showContractForm}
      title={
        <span className="flex items-center gap-3">
          <VendorAvatar name={vendor.company_name} />
          <span className="min-w-0 truncate">{vendor.company_name}</span>
        </span>
      }
      description={
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <TierBadge tier={vendor.tier} />
          <Badge tone={vendor.is_active ? "success" : "neutral"}>{vendor.is_active ? "Active" : "Inactive"}</Badge>
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="sm:mr-auto">
            Close
          </Button>
          <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => onEdit(vendor)}>
            Edit
          </Button>
          <Button
            icon={<Mail size={16} />}
            loading={emailSending}
            loadingText="Sending…"
            onClick={() => onSendEmail(vendor.primary_contact_email)}
          >
            Send job
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Contact info */}
        <section>
          <SectionTitle>Contact information</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoTile icon={<Users size={16} />} label="Primary contact" value={vendor.primary_contact_name} />
            <InfoTile icon={<Mail size={16} />} label="Email" value={vendor.primary_contact_email} />
            {vendor.primary_contact_phone && (
              <InfoTile icon={<Phone size={16} />} label="Phone" value={vendor.primary_contact_phone} />
            )}
            <InfoTile
              icon={<Calendar size={16} />}
              label="Member since"
              value={new Date(vendor.created_at).toLocaleDateString()}
            />
          </div>
        </section>

        {(vendor.registration_number || vendor.gst_id) && (
          <section>
            <SectionTitle>Registration details</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {vendor.registration_number && (
                <InfoTile icon={<Hash size={16} />} label="Registration no." value={vendor.registration_number} />
              )}
              {vendor.gst_id && <InfoTile icon={<Hash size={16} />} label="GST ID" value={vendor.gst_id} />}
            </div>
          </section>
        )}

        {/* Performance metrics — live from scorecard when available */}
        <section>
          <SectionTitle
            icon={<BarChart2 size={16} className="text-muted" aria-hidden="true" />}
            extra={scorecard ? <Badge tone="success" className="ml-1">Live</Badge> : null}
          >
            Performance metrics
          </SectionTitle>
          <div className="mb-4 grid grid-cols-3 gap-3">
            {[
              { label: "Submissions", value: metrics.submission_count },
              { label: "Shortlist rate", value: `${metrics.shortlist_rate}%` },
              { label: "Fill rate", value: `${metrics.fill_rate}%` },
            ].map((m) => (
              <div key={m.label} className="rounded-lg bg-surface p-3 text-center">
                <p className="font-display text-xl font-semibold text-ink">{m.value}</p>
                <p className="mt-0.5 text-xs text-muted">{m.label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {[
              { label: "Quality score", icon: TrendingUp, value: metrics.quality_score, color: qualityColor(metrics.quality_score) },
              { label: "SLA adherence", icon: CheckCircle2, value: metrics.sla_adherence, color: slaColor(metrics.sla_adherence) },
            ].map((m) => (
              <div key={m.label}>
                <div className="mb-1 flex items-center justify-between text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <m.icon size={12} aria-hidden="true" />
                    {m.label}
                  </span>
                  <span className="font-semibold text-ink">{m.value}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                  <div
                    className={`h-full rounded-full transition-all ${m.color}`}
                    style={{ width: `${Math.min(100, Math.max(0, Number(m.value) || 0))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {scorecard && scorecard.job_breakdown.length > 0 && (
          <section>
            <SectionTitle>Job breakdown</SectionTitle>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[420px] border-collapse text-left text-sm">
                <thead className="bg-surface">
                  <tr>
                    {["Job", "Submitted", "Shortlisted", "Hired"].map((h) => (
                      <th key={h} scope="col" className="whitespace-nowrap border-b border-line px-3 py-2 text-xs font-medium text-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scorecard.job_breakdown.map((row) => (
                    <tr key={row.job_id} className="border-b border-line last:border-0 hover:bg-surface">
                      <td className="max-w-[200px] truncate px-3 py-2 font-medium text-ink">{row.title}</td>
                      <td className="px-3 py-2 text-ink-soft">{row.submissions}</td>
                      <td className="px-3 py-2 font-semibold text-brand-700">{row.shortlisted}</td>
                      <td className="px-3 py-2 font-semibold text-success-700">{row.hired}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {scorecard && scorecard.recent_submissions.length > 0 && (
          <section>
            <SectionTitle>Recent submissions</SectionTitle>
            <ol className="space-y-2">
              {scorecard.recent_submissions.map((s) => {
                const fb = localFeedback[s.submission_id];
                const currentRating = fb !== undefined ? fb.rating : s.recruiter_rating;
                const currentNotes = fb !== undefined ? fb.notes : (s.recruiter_notes ?? "");
                const isDirty =
                  fb !== undefined && (fb.rating !== s.recruiter_rating || fb.notes !== (s.recruiter_notes ?? ""));
                return (
                  <li key={s.submission_id} className="space-y-2 rounded-lg bg-surface p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{s.candidate_full_name}</p>
                        <p className="truncate text-xs text-muted">{s.job_title}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {s.pipeline_stage && <StageBadge stage={s.pipeline_stage} short />}
                        <p className="mt-0.5 text-xs text-muted">
                          {new Date(s.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                          aria-pressed={star <= (currentRating ?? 0)}
                          onClick={() =>
                            setLocalFeedback((prev) => ({
                              ...prev,
                              [s.submission_id]: {
                                rating: star === currentRating ? null : star,
                                notes: currentNotes,
                                saving: false,
                              },
                            }))
                          }
                          className="rounded p-0.5"
                        >
                          <Star
                            size={16}
                            aria-hidden="true"
                            className={star <= (currentRating ?? 0) ? "fill-brand-500 text-brand-500" : "text-line-strong"}
                          />
                        </button>
                      ))}
                      {isDirty && (
                        <Button
                          size="sm"
                          className="ml-2"
                          loading={fb?.saving}
                          loadingText="Saving…"
                          onClick={() => handleSaveFeedback(s.submission_id)}
                        >
                          Save
                        </Button>
                      )}
                    </div>
                    {isDirty && (
                      <input
                        type="text"
                        aria-label="Feedback note"
                        placeholder="Add a note…"
                        value={currentNotes}
                        onChange={(e) =>
                          setLocalFeedback((prev) => ({
                            ...prev,
                            [s.submission_id]: { ...prev[s.submission_id], notes: e.target.value },
                          }))
                        }
                        className="zh-input py-1.5"
                      />
                    )}
                    {!isDirty && s.recruiter_notes && <p className="text-xs italic text-muted">"{s.recruiter_notes}"</p>}
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* Contracts */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle
              icon={<FileText size={16} className="text-muted" aria-hidden="true" />}
              extra={contracts.length > 0 ? <Badge tone="navy" className="ml-1">{contracts.length}</Badge> : null}
            >
              Contracts
            </SectionTitle>
            <Button
              variant="ghost"
              size="sm"
              iconRight={showContractForm && !editingContract ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              onClick={() => {
                setEditingContract(null);
                setContractForm(emptyContractForm);
                setContractError("");
                setShowContractForm((v) => !v);
              }}
            >
              {showContractForm && !editingContract ? "Cancel" : "Add"}
            </Button>
          </div>

          {showContractForm && (
            <div className="mb-3 space-y-3 rounded-lg border border-line bg-surface p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="contract-title" className="zh-label">
                    Title *
                  </label>
                  <input
                    id="contract-title"
                    type="text"
                    value={contractForm.title}
                    onChange={(e) => setCF("title", e.target.value)}
                    placeholder="Master Service Agreement 2025"
                    className="zh-input"
                  />
                </div>
                <div>
                  <label htmlFor="contract-type" className="zh-label">
                    Type
                  </label>
                  <select
                    id="contract-type"
                    value={contractForm.contract_type}
                    onChange={(e) => setCF("contract_type", e.target.value)}
                    className="zh-input"
                  >
                    <option value="msa">MSA</option>
                    <option value="nda">NDA</option>
                    <option value="sow">SOW</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="contract-status" className="zh-label">
                    Status
                  </label>
                  <select
                    id="contract-status"
                    value={contractForm.status}
                    onChange={(e) => setCF("status", e.target.value)}
                    className="zh-input"
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="expired">Expired</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="contract-start" className="zh-label">
                    Start date *
                  </label>
                  <input
                    id="contract-start"
                    type="date"
                    value={contractForm.start_date}
                    onChange={(e) => setCF("start_date", e.target.value)}
                    className="zh-input"
                  />
                </div>
                <div>
                  <label htmlFor="contract-end" className="zh-label">
                    End date
                  </label>
                  <input
                    id="contract-end"
                    type="date"
                    value={contractForm.end_date}
                    onChange={(e) => setCF("end_date", e.target.value)}
                    className="zh-input"
                  />
                </div>
                <div>
                  <label htmlFor="contract-value" className="zh-label">
                    Value (INR)
                  </label>
                  <input
                    id="contract-value"
                    type="number"
                    value={contractForm.value}
                    onChange={(e) => setCF("value", e.target.value)}
                    placeholder="500000"
                    className="zh-input"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="contract-notes" className="zh-label">
                    Notes
                  </label>
                  <input
                    id="contract-notes"
                    type="text"
                    value={contractForm.notes}
                    onChange={(e) => setCF("notes", e.target.value)}
                    placeholder="Optional notes…"
                    className="zh-input"
                  />
                </div>
              </div>
              {contractError && <p className="text-xs text-danger-600">{contractError}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowContractForm(false);
                    setEditingContract(null);
                    setContractForm(emptyContractForm);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveContract} loading={contractCreating} loadingText="Saving…">
                  {editingContract ? "Update" : "Add contract"}
                </Button>
              </div>
            </div>
          )}

          {contracts.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">No contracts yet.</p>
          ) : (
            <div className="space-y-2">
              {contracts.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg bg-surface p-3">
                  <div className="min-w-0">
                    <div className="mb-0.5 flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-ink">{c.title}</p>
                      <Badge tone={contractTone[c.status] ?? "neutral"}>
                        {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted">
                      {c.contract_type.toUpperCase()} · {fmtDate(c.start_date)}
                      {c.end_date && ` → ${fmtDate(c.end_date)}`}
                      {c.value ? ` · ₹${Number(c.value).toLocaleString("en-IN")}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Edit ${c.title}`}
                      onClick={() => {
                        setEditingContract(c);
                        setContractForm({
                          title: c.title,
                          contract_type: c.contract_type,
                          start_date: c.start_date,
                          end_date: c.end_date ?? "",
                          status: c.status,
                          value: c.value ? String(c.value) : "",
                          notes: c.notes ?? "",
                        });
                        setContractError("");
                        setShowContractForm(true);
                      }}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-navy-50 hover:text-navy-600"
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${c.title}`}
                      onClick={() => handleDeleteContract(c.id)}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-danger-50 hover:text-danger-600"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {(vendor.industry_specializations.length > 0 || vendor.geographies.length > 0) && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {vendor.industry_specializations.length > 0 && (
              <section>
                <SectionTitle icon={<Briefcase size={16} className="text-muted" aria-hidden="true" />}>Specializations</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  {vendor.industry_specializations.map((spec) => (
                    <Badge key={spec} tone="navy">
                      {spec}
                    </Badge>
                  ))}
                </div>
              </section>
            )}
            {vendor.geographies.length > 0 && (
              <section>
                <SectionTitle icon={<MapPin size={16} className="text-muted" aria-hidden="true" />}>Geographies</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  {vendor.geographies.map((geo) => (
                    <Badge key={geo}>{geo}</Badge>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
