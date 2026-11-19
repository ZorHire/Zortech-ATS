import { useState, useRef, useCallback } from "react";
import { X, Upload, FileText, CheckCircle2, XCircle, ArrowLeft, Eye } from "lucide-react";
import {
  useParseVendorMutation,
  useCreateVendorMutation,
} from "../../store/api/vendorApi";
import { Badge, Button, Modal, Spinner } from "../ui";
import type { BadgeTone } from "../ui";

type FileStatus = "pending" | "parsing" | "parsed" | "error" | "saving" | "saved";

interface ParsedVendor {
  company_name: string;
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone: string;
  industry_specializations: string;
  geographies: string;
  tier: string;
  registration_number: string;
  gst_id: string;
}

interface UploadFile {
  file: File;
  status: FileStatus;
  result?: ParsedVendor;
  error?: string;
}

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

const tiers = [
  { value: "preferred", label: "Preferred" },
  { value: "standard", label: "Standard" },
  { value: "blocked", label: "Blocked" },
];

export default function BulkVendorUploadModal({ onClose, onSuccess }: Props) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [view, setView] = useState<"upload" | "preview">("upload");
  const [saving, setSaving] = useState(false);
  const [overallError, setOverallError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parseVendor] = useParseVendorMutation();
  const [createVendor] = useCreateVendorMutation();

  const processFiles = useCallback(
    async (newFiles: File[]) => {
      const entries: UploadFile[] = newFiles.map((f) => ({ file: f, status: "pending" }));

      setFiles((prev) => {
        const existing = new Set(prev.map((f) => f.file.name));
        return [...prev, ...entries.filter((e) => !existing.has(e.file.name))];
      });

      for (const entry of entries) {
        setFiles((prev) =>
          prev.map((f) => f.file.name === entry.file.name ? { ...f, status: "parsing" } : f),
        );
        try {
          const fd = new FormData();
          fd.append("file", entry.file);
          const parsed = await parseVendor(fd).unwrap();
          const p = parsed as any;
          const result: ParsedVendor = {
            company_name: p.company_name || "",
            primary_contact_name: p.primary_contact_name || "",
            primary_contact_email: p.primary_contact_email || "",
            primary_contact_phone: p.primary_contact_phone || "",
            industry_specializations: Array.isArray(p.industry_specializations)
              ? p.industry_specializations.join(", ")
              : (p.industry_specializations || ""),
            geographies: Array.isArray(p.geographies)
              ? p.geographies.join(", ")
              : (p.geographies || ""),
            tier: p.tier || "standard",
            registration_number: p.registration_number || "",
            gst_id: p.gst_id || "",
          };
          setFiles((prev) =>
            prev.map((f) => f.file.name === entry.file.name ? { ...f, status: "parsed", result } : f),
          );
        } catch {
          setFiles((prev) =>
            prev.map((f) =>
              f.file.name === entry.file.name ? { ...f, status: "error", error: "Could not parse" } : f,
            ),
          );
        }
      }
    },
    [parseVendor],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(pdf|doc|docx)$/i.test(f.name),
    );
    if (dropped.length) processFiles(dropped);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length) processFiles(selected);
    e.target.value = "";
  };

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.file.name !== name));

  const updateResult = (name: string, field: string, value: string) =>
    setFiles((prev) =>
      prev.map((f) =>
        f.file.name === name ? { ...f, result: { ...f.result!, [field]: value } } : f,
      ),
    );

  const parsedFiles = files.filter((f) => f.status === "parsed");
  const anyParsing = files.some((f) => f.status === "parsing");

  const handleSaveAll = async () => {
    setSaving(true);
    setOverallError("");
    let successCount = 0;

    for (const f of parsedFiles) {
      if (!f.result) continue;
      const r = f.result;
      if (!r.company_name.trim()) {
        setFiles((prev) =>
          prev.map((pf) =>
            pf.file.name === f.file.name
              ? { ...pf, status: "error", error: "Company name required" }
              : pf,
          ),
        );
        continue;
      }
      try {
        await createVendor({
          company_name: r.company_name,
          primary_contact_name: r.primary_contact_name,
          primary_contact_email: r.primary_contact_email,
          primary_contact_phone: r.primary_contact_phone,
          industry_specializations: r.industry_specializations
            .split(",").map((s) => s.trim()).filter(Boolean),
          geographies: r.geographies
            .split(",").map((s) => s.trim()).filter(Boolean),
          tier: r.tier,
          registration_number: r.registration_number,
          gst_id: r.gst_id,
        }).unwrap();
        setFiles((prev) =>
          prev.map((pf) => pf.file.name === f.file.name ? { ...pf, status: "saved" } : pf),
        );
        successCount++;
      } catch {
        setFiles((prev) =>
          prev.map((pf) =>
            pf.file.name === f.file.name ? { ...pf, status: "error", error: "Save failed" } : pf,
          ),
        );
      }
    }

    setSaving(false);
    if (successCount > 0) {
      onSuccess?.();
      onClose();
    } else {
      setOverallError("All saves failed. Check required fields and try again.");
    }
  };

  const statusIcon = (status: FileStatus) => {
    if (status === "parsing" || status === "saving") return <Spinner size={14} className="shrink-0" />;
    if (status === "parsed" || status === "saved")
      return <CheckCircle2 size={16} className="shrink-0 text-success-600" aria-hidden="true" />;
    if (status === "error") return <XCircle size={16} className="shrink-0 text-danger-600" aria-hidden="true" />;
    return <FileText size={16} className="shrink-0 text-muted" aria-hidden="true" />;
  };

  const statusBadge = (f: UploadFile) => {
    const map: Record<FileStatus, { label: string; tone: BadgeTone }> = {
      pending: { label: "Pending", tone: "neutral" },
      parsing: { label: "Parsing…", tone: "navy" },
      parsed: { label: "Ready", tone: "success" },
      error: { label: f.error || "Error", tone: "danger" },
      saving: { label: "Saving…", tone: "navy" },
      saved: { label: "Saved", tone: "success" },
    };
    const { label, tone } = map[f.status];
    return <Badge tone={tone}>{label}</Badge>;
  };

  const inputId = (name: string, field: string) => `bulk-vendor-${field}-${name.replace(/[^a-z0-9]/gi, "-")}`;

  const textField = (f: UploadFile, label: string, field: keyof ParsedVendor, wide = false) => (
    <div key={field} className={wide ? "sm:col-span-2" : ""}>
      <label htmlFor={inputId(f.file.name, field)} className="zh-label">
        {label}
      </label>
      <input
        id={inputId(f.file.name, field)}
        type="text"
        value={f.result![field]}
        onChange={(e) => updateResult(f.file.name, field, e.target.value)}
        className="zh-input"
      />
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      preventClose={saving}
      title={
        view === "upload"
          ? "Bulk vendor import"
          : `Preview: ${parsedFiles.length} vendor${parsedFiles.length !== 1 ? "s" : ""}`
      }
      description={
        view === "upload"
          ? "Upload vendor documents to import multiple vendors at once"
          : "Review parsed vendor details before saving"
      }
      footer={
        view === "upload" ? (
          <>
            <span className="text-sm text-muted sm:mr-auto sm:self-center" aria-live="polite">
              {anyParsing
                ? "Parsing documents…"
                : parsedFiles.length > 0
                  ? `${parsedFiles.length} of ${files.length} ready to preview`
                  : "No files added yet"}
            </span>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              icon={<Eye size={16} />}
              onClick={() => setView("preview")}
              disabled={parsedFiles.length === 0 || anyParsing}
            >
              Preview ({parsedFiles.length})
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              icon={<ArrowLeft size={16} />}
              onClick={() => setView("upload")}
              disabled={saving}
              className="sm:mr-auto"
            >
              Back
            </Button>
            <Button onClick={handleSaveAll} loading={saving} loadingText="Saving…">
              {`Save ${parsedFiles.length} vendor${parsedFiles.length !== 1 ? "s" : ""}`}
            </Button>
          </>
        )
      }
    >
      {view === "upload" ? (
        <div className="space-y-6">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Add vendor documents"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`cursor-pointer select-none rounded-xl border-2 border-dashed p-8 text-center transition-colors sm:p-10 ${
              isDragging ? "border-navy-500 bg-navy-50" : "border-line-strong hover:border-navy-400 hover:bg-surface"
            }`}
          >
            <Upload size={28} className={`mx-auto mb-3 ${isDragging ? "text-navy-600" : "text-muted"}`} aria-hidden="true" />
            <p className="text-sm font-semibold text-ink">Drop vendor documents here or click to browse</p>
            <p className="mt-1 text-xs text-muted">PDF, DOC, DOCX. Multiple files supported.</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted">
                {files.length} file{files.length !== 1 ? "s" : ""} selected
              </p>
              <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                {files.map((f) => (
                  <li key={f.file.name} className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2.5">
                    {statusIcon(f.status)}
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{f.file.name}</span>
                    {statusBadge(f)}
                    {f.status !== "parsing" && (
                      <button
                        type="button"
                        onClick={() => removeFile(f.file.name)}
                        aria-label={`Remove ${f.file.name}`}
                        className="shrink-0 rounded-md p-1 text-muted hover:bg-danger-50 hover:text-danger-600"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {parsedFiles.map((f) => (
            <div key={f.file.name} className="space-y-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <FileText size={14} className="shrink-0 text-navy-600" aria-hidden="true" />
                <span className="truncate text-xs font-medium text-muted">{f.file.name}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {textField(f, "Company name *", "company_name", true)}
                {textField(f, "Contact name", "primary_contact_name")}
                {textField(f, "Contact email", "primary_contact_email")}
                {textField(f, "Contact phone", "primary_contact_phone")}
                {textField(f, "Registration no.", "registration_number")}
                {textField(f, "GST ID", "gst_id")}
                <div>
                  <label htmlFor={inputId(f.file.name, "tier")} className="zh-label">
                    Tier
                  </label>
                  <select
                    id={inputId(f.file.name, "tier")}
                    value={f.result!.tier}
                    onChange={(e) => updateResult(f.file.name, "tier", e.target.value)}
                    className="zh-input"
                  >
                    {tiers.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                {textField(f, "Industry specializations (comma separated)", "industry_specializations", true)}
                {textField(f, "Geographies (comma separated)", "geographies", true)}
              </div>
            </div>
          ))}
          {overallError && (
            <p role="alert" className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {overallError}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
