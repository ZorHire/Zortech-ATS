import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { ExternalLink, FileCheck2, RotateCcw, Ban, Trash2, Upload, ChevronDown, ChevronUp } from "lucide-react";
import {
  useGetVendorDocumentsQuery,
  useUploadVendorDocumentMutation,
  useDeleteVendorDocumentMutation,
  useUpdateVendorDocStatusMutation,
  openVendorDocument,
  VENDOR_DOC_TYPE_LABELS,
  VENDOR_DOC_MAX_BYTES,
  VENDOR_DOC_EXTENSIONS,
  computeDocsStatus,
} from "../../store/api/vendorDocsApi";
import type { VendorDocument, VendorDocumentType } from "../../store/api/vendorDocsApi";
import { describeApiError } from "../../store/api/baseApi";
import { useAppSelector } from "../../hooks/useAppSelector";
import { selectAccessToken, selectCurrentUser } from "../../store/slices/authSlice";
import { useNotify } from "../../hooks/useNotify";
import { Badge, Button, EmptyState, ErrorState, Skeleton, useConfirm } from "../ui";
import type { BadgeTone } from "../ui";
import { DocsStatusBadge } from "./vendorUi";

/** Roles the backend lets change a document's status or delete it (vendors.routes.ts). */
const DOC_ADMIN_ROLES = ["super_admin", "accounts_manager"];

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const statusTone: Record<string, BadgeTone> = { active: "success", expired: "danger", revoked: "neutral" };
const statusLabel: Record<string, string> = { active: "Active", expired: "Expired", revoked: "Revoked" };

/** "Expired" / "Expires in N days" badge; nothing when the expiry is far away or unset. */
export function ExpiryBadge({ days }: { days: number | null | undefined }) {
  if (days === null || days === undefined) return null;
  const n = Number(days);
  if (n < 0) return <Badge tone="danger">Expired</Badge>;
  if (n === 0) return <Badge tone="warning">Expires today</Badge>;
  if (n <= 30) return <Badge tone="warning">{`Expires in ${n} day${n === 1 ? "" : "s"}`}</Badge>;
  return null;
}

const emptyForm = { document_type: "nda" as VendorDocumentType, expiry_date: "" };

export default function VendorDocumentsSection({
  vendorId,
  onFormOpenChange,
}: {
  vendorId: string;
  /** Lets the parent modal stop backdrop-close while the upload form has input. */
  onFormOpenChange?: (open: boolean) => void;
}) {
  const notify = useNotify();
  const confirm = useConfirm();
  const token = useAppSelector(selectAccessToken);
  const role = useAppSelector(selectCurrentUser)?.role ?? "";
  const canAdmin = DOC_ADMIN_ROLES.includes(role);

  const { data: docs = [], isLoading, isError, error, refetch, isFetching } = useGetVendorDocumentsQuery(vendorId);
  const [uploadDoc, { isLoading: uploading }] = useUploadVendorDocumentMutation();
  const [deleteDoc] = useDeleteVendorDocumentMutation();
  const [updateStatus] = useUpdateVendorDocStatusMutation();

  const [showForm, setShowFormState] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const setShowForm = (open: boolean) => {
    setShowFormState(open);
    onFormOpenChange?.(open);
    if (!open) {
      setForm(emptyForm);
      setFile(null);
      setFormError("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const openUpload = (type?: VendorDocumentType) => {
    setShowForm(true);
    if (type) setForm((f) => ({ ...f, document_type: type }));
  };

  const pickFile = (f: File | null) => {
    setFormError("");
    if (!f) return setFile(null);
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!VENDOR_DOC_EXTENSIONS.includes(ext)) {
      setFormError("Upload a PDF, Word (DOC/DOCX) or image (PNG/JPG) file.");
      setFile(null);
      return;
    }
    if (f.size > VENDOR_DOC_MAX_BYTES) {
      setFormError("File is too large. The limit is 10 MB.");
      setFile(null);
      return;
    }
    setFile(f);
  };

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setFormError("Choose a file to upload.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("document_type", form.document_type);
    if (form.expiry_date) fd.append("expiry_date", form.expiry_date);
    try {
      await uploadDoc({ vendorId, formData: fd }).unwrap();
      notify.success(`${VENDOR_DOC_TYPE_LABELS[form.document_type]} uploaded`);
      setShowForm(false);
    } catch (err) {
      setFormError(describeApiError(err, "Upload failed. Please try again."));
    }
  };

  const handleOpen = async (doc: VendorDocument) => {
    setBusyId(doc.id);
    try {
      await openVendorDocument(vendorId, doc.id, token);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Could not open this document.");
    } finally {
      setBusyId(null);
    }
  };

  const handleStatus = async (doc: VendorDocument, status: "active" | "revoked") => {
    setBusyId(doc.id);
    try {
      await updateStatus({ vendorId, docId: doc.id, status }).unwrap();
      notify.success(status === "active" ? "Document restored" : "Document revoked");
    } catch (err) {
      notify.error(describeApiError(err, "Could not update the document."));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (doc: VendorDocument) => {
    const label = VENDOR_DOC_TYPE_LABELS[doc.document_type] ?? "document";
    if (
      !(await confirm({
        title: `Delete this ${label}?`,
        message: `${doc.file_name} will be removed from this vendor. This cannot be undone.`,
        danger: true,
        confirmText: "Delete",
      }))
    )
      return;
    try {
      await deleteDoc({ vendorId, docId: doc.id }).unwrap();
      notify.success("Document deleted");
    } catch (err) {
      notify.error(describeApiError(err, "Could not delete the document."));
    }
  };

  const forbidden = (error as { status?: unknown } | undefined)?.status === 403;
  const summary = computeDocsStatus(docs);
  const missing = summary.missing;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <FileCheck2 size={16} className="text-muted" aria-hidden="true" />
          Documents
          {!isLoading && !isError && <DocsStatusBadge status={summary.status} className="ml-1" />}
        </h3>
        {!forbidden && (
          <Button
            variant="ghost"
            size="sm"
            iconRight={showForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            onClick={() => (showForm ? setShowForm(false) : openUpload())}
          >
            {showForm ? "Cancel" : "Upload"}
          </Button>
        )}
      </div>

      {!isLoading && !isError && docs.length > 0 && missing.length > 0 && (
        <p className="mb-3 text-xs text-muted">
          Still needed for onboarding:{" "}
          {missing.map((t, i) => (
            <span key={t}>
              {i > 0 && ", "}
              <button type="button" className="font-medium text-navy-600 hover:underline" onClick={() => openUpload(t)}>
                {VENDOR_DOC_TYPE_LABELS[t]}
              </button>
            </span>
          ))}
        </p>
      )}

      {showForm && (
        <form onSubmit={handleUpload} noValidate className="mb-3 space-y-3 rounded-lg border border-line bg-surface p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`doc-type-${vendorId}`} className="zh-label">
                Document type *
              </label>
              <select
                id={`doc-type-${vendorId}`}
                value={form.document_type}
                onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value as VendorDocumentType }))}
                className="zh-input"
              >
                {(Object.keys(VENDOR_DOC_TYPE_LABELS) as VendorDocumentType[]).map((t) => (
                  <option key={t} value={t}>
                    {VENDOR_DOC_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`doc-expiry-${vendorId}`} className="zh-label">
                Expiry date
              </label>
              <input
                id={`doc-expiry-${vendorId}`}
                type="date"
                value={form.expiry_date}
                onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
                className="zh-input"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={`doc-file-${vendorId}`} className="zh-label">
                File *
              </label>
              <input
                id={`doc-file-${vendorId}`}
                ref={fileRef}
                type="file"
                accept={VENDOR_DOC_EXTENSIONS.map((x) => `.${x}`).join(",")}
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                className="zh-input py-1.5"
              />
              <p className="mt-1 text-xs text-muted">PDF, DOC, DOCX, PNG or JPG, up to 10 MB.</p>
            </div>
          </div>
          {formError && <p className="text-xs text-danger-600">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" icon={<Upload size={14} />} loading={uploading} loadingText="Uploading…">
              Upload
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-2" role="status" aria-label="Loading documents">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2 rounded-lg bg-surface p-3">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : forbidden ? (
        <p className="rounded-lg bg-surface p-3 text-sm text-muted">
          Only admins, accounts managers and vendor managers can see vendor documents.
        </p>
      ) : isError ? (
        <ErrorState compact error={error} onRetry={refetch} retrying={isFetching} />
      ) : docs.length === 0 ? (
        !showForm && (
          <EmptyState
            compact
            icon={<FileCheck2 size={22} aria-hidden="true" />}
            title="No documents yet"
            description="Upload the NDA to start onboarding. A vendor is onboarded once the NDA and service agreement are on file."
            action={
              <Button size="sm" icon={<Upload size={14} />} onClick={() => openUpload("nda")}>
                Upload NDA
              </Button>
            }
          />
        )
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => {
            const days = doc.days_until_expiry === null ? null : Number(doc.days_until_expiry);
            const lapsed = doc.status === "active" && days !== null && days < 0;
            const busy = busyId === doc.id;
            return (
              <li key={doc.id} className="flex flex-col gap-2 rounded-lg bg-surface p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-0.5 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink">{VENDOR_DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}</p>
                    {lapsed ? (
                      <Badge tone="danger">Expired</Badge>
                    ) : (
                      <Badge tone={statusTone[doc.status] ?? "neutral"}>{statusLabel[doc.status] ?? doc.status}</Badge>
                    )}
                    {doc.status === "active" && !lapsed && <ExpiryBadge days={days} />}
                  </div>
                  <p className="truncate text-xs text-ink-soft" title={doc.file_name}>
                    {doc.file_name}
                  </p>
                  <p className="text-xs text-muted">
                    Uploaded {fmtDate(doc.created_at)}
                    {doc.uploaded_by_name ? ` by ${doc.uploaded_by_name}` : ""}
                    {doc.expiry_date ? ` · Expires ${fmtDate(doc.expiry_date)}` : " · No expiry"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<ExternalLink size={14} />}
                    loading={busy}
                    onClick={() => handleOpen(doc)}
                    aria-label={`View ${doc.file_name}`}
                  >
                    View
                  </Button>
                  {canAdmin && doc.status === "active" && (
                    <button
                      type="button"
                      title="Revoke"
                      aria-label={`Revoke ${doc.file_name}`}
                      disabled={busy}
                      onClick={() => handleStatus(doc, "revoked")}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-warning-50 hover:text-warning-700 disabled:opacity-40"
                    >
                      <Ban size={14} aria-hidden="true" />
                    </button>
                  )}
                  {canAdmin && doc.status !== "active" && (
                    <button
                      type="button"
                      title="Mark active"
                      aria-label={`Mark ${doc.file_name} active`}
                      disabled={busy}
                      onClick={() => handleStatus(doc, "active")}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-success-50 hover:text-success-700 disabled:opacity-40"
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                    </button>
                  )}
                  {canAdmin && (
                    <button
                      type="button"
                      title="Delete"
                      aria-label={`Delete ${doc.file_name}`}
                      disabled={busy}
                      onClick={() => handleDelete(doc)}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-40"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
