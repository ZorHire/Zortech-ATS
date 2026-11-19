import { useState, useRef, useCallback } from "react";
import {
  X, Upload, FileText, CheckCircle2, XCircle, Loader2,
  ArrowLeft, Eye,
} from "lucide-react";
import { Badge, Button, Modal } from "../ui";
import type { BadgeTone } from "../ui";
import {
  useParseResumeMutation,
  useCreateCandidateMutation,
  useAddCandidateToJobMutation,
} from "../../store/api/candidateApi";
import { useGetJobsQuery } from "../../store/api/jobApi";

type FileStatus = "pending" | "parsing" | "parsed" | "error" | "saving" | "saved";

interface UploadFile {
  file: File;
  status: FileStatus;
  result?: Record<string, string | number>;
  error?: string;
}

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

const sourceLabels: Record<string, string> = {
  linkedin: "LinkedIn", indeed: "Indeed", naukri: "Naukri", monster: "Monster",
  vendor: "Vendor", referral: "Referral", direct: "Direct", other: "Other",
};

export default function BulkResumeUploadModal({ onClose, onSuccess }: Props) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [view, setView] = useState<"upload" | "preview">("upload");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [saving, setSaving] = useState(false);
  const [overallError, setOverallError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parseResume] = useParseResumeMutation();
  const [createCandidate] = useCreateCandidateMutation();
  const [addCandidateToJob] = useAddCandidateToJobMutation();
  const { data: jobs = [] } = useGetJobsQuery();

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
          const parsed = await parseResume(fd).unwrap();
          const p = parsed as any;
          const result: Record<string, string | number> = {
            first_name: p.name?.split(" ")[0] || "",
            last_name: p.name?.split(" ").slice(1).join(" ") || "",
            email: p.email || "",
            phone: p.phone || "",
            current_title: p.current_title || "",
            current_company: p.current_company || "",
            experience_years: p.experience_years ?? 0,
            current_location: p.current_location || "",
            skills: Array.isArray(p.skills) ? p.skills.join(", ") : (p.skills || ""),
            source: "direct",
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
    [parseResume],
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
        f.file.name === name ? { ...f, result: { ...f.result, [field]: value } } : f,
      ),
    );

  const parsedFiles = files.filter((f) => f.status === "parsed");

  const handleSaveAll = async () => {
    setSaving(true);
    setOverallError("");
    let successCount = 0;

    for (const f of parsedFiles) {
      if (!f.result) continue;
      try {
        const fd = new FormData();
        const r = f.result;
        fd.append("first_name", String(r.first_name || "Unknown"));
        fd.append("last_name", String(r.last_name || ""));
        fd.append("email", String(r.email || ""));
        fd.append("phone", String(r.phone || ""));
        fd.append("current_title", String(r.current_title || ""));
        fd.append("current_company", String(r.current_company || ""));
        fd.append("experience_years", String(r.experience_years ?? 0));
        fd.append("current_location", String(r.current_location || ""));
        fd.append("source", String(r.source || "direct"));
        fd.append(
          "skills",
          JSON.stringify(
            String(r.skills || "").split(",").map((s) => s.trim()).filter(Boolean),
          ),
        );
        fd.append("resume", f.file);

        if (selectedJobId) {
          await addCandidateToJob({ jobId: selectedJobId, body: fd }).unwrap();
        } else {
          await createCandidate(fd).unwrap();
        }

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
      setOverallError("All saves failed. Check your network and try again.");
    }
  };

  const statusIcon = (status: FileStatus) => {
    if (status === "parsing" || status === "saving")
      return <Loader2 size={14} className="shrink-0 animate-spin text-navy-500" aria-hidden="true" />;
    if (status === "parsed" || status === "saved")
      return <CheckCircle2 size={14} className="shrink-0 text-success-600" aria-hidden="true" />;
    if (status === "error")
      return <XCircle size={14} className="shrink-0 text-danger-600" aria-hidden="true" />;
    return <FileText size={14} className="shrink-0 text-muted" aria-hidden="true" />;
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

  const anyParsing = files.some((f) => f.status === "parsing");

  const title =
    view === "upload"
      ? "Bulk resume upload"
      : `Preview: ${parsedFiles.length} candidate${parsedFiles.length !== 1 ? "s" : ""}`;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      preventClose={saving}
      title={title}
      description={view === "upload" ? "Drop multiple resumes to import them all at once." : "Review and edit the parsed details before saving."}
      footer={
        view === "upload" ? (
          <>
            <span className="self-center text-xs text-muted sm:mr-auto" role="status">
              {anyParsing
                ? "Parsing resumes…"
                : parsedFiles.length > 0
                ? `${parsedFiles.length} of ${files.length} ready to preview`
                : "No files added yet"}
            </span>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => setView("preview")}
              disabled={parsedFiles.length === 0 || anyParsing}
              icon={<Eye size={14} />}
            >
              Preview ({parsedFiles.length})
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setView("upload")} disabled={saving} icon={<ArrowLeft size={14} />} className="sm:mr-auto">
              Back
            </Button>
            <Button onClick={handleSaveAll} loading={saving} loadingText="Saving…">
              {`Save ${parsedFiles.length} candidate${parsedFiles.length !== 1 ? "s" : ""}`}
            </Button>
          </>
        )
      }
    >
      {view === "upload" ? (
        <div className="space-y-5">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose resume files"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
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
            <p className="text-sm font-medium text-ink">Drop resumes here or click to browse</p>
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

          {/* Optional JD assignment */}
          {jobs.length > 0 && (
            <div>
              <label htmlFor="bru-job" className="zh-label">
                Assign to job (optional)
              </label>
              <select
                id="bru-job"
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="zh-input"
              >
                <option value="">No assignment: add to candidate pool only</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}{(j as any).client?.name ? ` — ${(j as any).client.name}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted">
                {files.length} file{files.length !== 1 ? "s" : ""} selected
              </p>
              <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                {files.map((f) => (
                  <li key={f.file.name} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
                    {statusIcon(f.status)}
                    <span className="flex-1 truncate text-sm text-ink">{f.file.name}</span>
                    {statusBadge(f)}
                    {f.status !== "parsing" && (
                      <button
                        type="button"
                        onClick={() => removeFile(f.file.name)}
                        aria-label={`Remove ${f.file.name}`}
                        className="shrink-0 rounded p-1 text-muted hover:bg-danger-50 hover:text-danger-600"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        // Preview view
        <div className="space-y-4">
          {parsedFiles.map((f, idx) => (
            <div key={f.file.name} className="space-y-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <FileText size={13} className="shrink-0 text-navy-600" aria-hidden="true" />
                <span className="truncate text-xs font-medium text-muted">{f.file.name}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(
                  [
                    ["First name", "first_name"],
                    ["Last name", "last_name"],
                    ["Email", "email"],
                    ["Phone", "phone"],
                    ["Current title", "current_title"],
                    ["Company", "current_company"],
                    ["Experience (yrs)", "experience_years"],
                    ["Location", "current_location"],
                  ] as [string, string][]
                ).map(([label, field]) => (
                  <div key={field}>
                    <label htmlFor={`bru-${idx}-${field}`} className="zh-label">
                      {label}
                    </label>
                    <input
                      id={`bru-${idx}-${field}`}
                      type={field === "experience_years" ? "number" : "text"}
                      value={f.result?.[field] as string ?? ""}
                      onChange={(e) => updateResult(f.file.name, field, e.target.value)}
                      className="zh-input py-2"
                    />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label htmlFor={`bru-${idx}-skills`} className="zh-label">
                    Skills (comma separated)
                  </label>
                  <input
                    id={`bru-${idx}-skills`}
                    type="text"
                    value={f.result?.skills as string ?? ""}
                    onChange={(e) => updateResult(f.file.name, "skills", e.target.value)}
                    className="zh-input py-2"
                  />
                </div>
                <div>
                  <label htmlFor={`bru-${idx}-source`} className="zh-label">
                    Source
                  </label>
                  <select
                    id={`bru-${idx}-source`}
                    value={f.result?.source as string ?? "direct"}
                    onChange={(e) => updateResult(f.file.name, "source", e.target.value)}
                    className="zh-input py-2"
                  >
                    {Object.entries(sourceLabels).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
          {overallError && (
            <p role="alert" className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{overallError}</p>
          )}
        </div>
      )}
    </Modal>
  );
}
