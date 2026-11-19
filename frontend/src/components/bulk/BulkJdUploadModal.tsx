import { useState, useRef, useCallback } from "react";
import {
  X, Upload, FileText, CheckCircle2, XCircle, ArrowLeft, Eye,
} from "lucide-react";
import { useParseJdMutation, useCreateJobMutation, useGetClientsQuery } from "../../store/api/jobApi";
import { Badge, Button, Modal, Spinner } from "../ui";
import type { BadgeTone } from "../ui";

type FileStatus = "pending" | "parsing" | "parsed" | "error" | "saving" | "saved";

interface ParsedJd {
  title: string;
  location: string;
  description: string;
  experience_min: number;
  experience_max: number;
  salary_min: number;
  salary_max: number;
  mandatory_skills: string;
  work_mode: string;
  employment_type: string;
  priority: string;
  headcount: number;
  client_id: string;
}

interface UploadFile {
  file: File;
  status: FileStatus;
  result?: ParsedJd;
  error?: string;
}

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

const workModes = [
  { value: "onsite", label: "Onsite" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
];

const priorities = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export default function BulkJdUploadModal({ onClose, onSuccess }: Props) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [view, setView] = useState<"upload" | "preview">("upload");
  const [saving, setSaving] = useState(false);
  const [overallError, setOverallError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parseJd] = useParseJdMutation();
  const [createJob] = useCreateJobMutation();
  const { data: clients = [] } = useGetClientsQuery();

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
          const parsed = await parseJd(fd).unwrap();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const p = parsed as any;
          const result: ParsedJd = {
            title: p.title || "",
            location: p.location || "",
            description: p.description || "",
            experience_min: p.experience_min ?? 0,
            experience_max: p.experience_max ?? 5,
            salary_min: p.salary_min ?? 0,
            salary_max: p.salary_max ?? 0,
            mandatory_skills: Array.isArray(p.required_skills)
              ? p.required_skills.join(", ")
              : (p.mandatory_skills || ""),
            work_mode: p.work_mode || "onsite",
            employment_type: p.employment_type || "full_time",
            priority: p.priority || "medium",
            headcount: p.headcount ?? 1,
            client_id: "",
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
    [parseJd],
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

  const updateResult = (name: string, field: string, value: string | number) =>
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
      if (!r.title.trim()) {
        setFiles((prev) =>
          prev.map((pf) =>
            pf.file.name === f.file.name ? { ...pf, status: "error", error: "Title required" } : pf,
          ),
        );
        continue;
      }
      try {
        await createJob({
          title: r.title,
          client_id: r.client_id || undefined,
          location: r.location,
          description: r.description,
          experience_min: Number(r.experience_min),
          experience_max: Number(r.experience_max),
          salary_min: Number(r.salary_min),
          salary_max: Number(r.salary_max),
          mandatory_skills: r.mandatory_skills.split(",").map((s) => s.trim()).filter(Boolean),
          work_mode: r.work_mode,
          employment_type: r.employment_type,
          priority: r.priority,
          headcount: Number(r.headcount),
          status: "draft",
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
      setOverallError("All saves failed. Please check required fields and try again.");
    }
  };

  const statusIcon = (status: FileStatus) => {
    if (status === "parsing" || status === "saving") return <Spinner size={14} className="shrink-0" />;
    if (status === "parsed" || status === "saved")
      return <CheckCircle2 size={15} className="shrink-0 text-success-600" />;
    if (status === "error") return <XCircle size={15} className="shrink-0 text-danger-600" />;
    return <FileText size={15} className="shrink-0 text-muted" />;
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

  return (
    <Modal
      open
      onClose={onClose}
      preventClose={saving}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          {view === "preview" && (
            <button
              type="button"
              onClick={() => setView("upload")}
              disabled={saving}
              aria-label="Back to upload"
              className="-ml-1.5 rounded-lg p-1.5 text-muted transition hover:bg-surface-sunken hover:text-ink"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          {view === "upload"
            ? "Bulk JD upload"
            : `Preview — ${parsedFiles.length} job${parsedFiles.length !== 1 ? "s" : ""}`}
        </span>
      }
      description={
        view === "upload"
          ? "Upload multiple JD documents to create jobs at once"
          : "Review parsed job details before creating"
      }
      footer={
        view === "upload" ? (
          <>
            <span className="text-xs text-muted sm:mr-auto sm:self-center">
              {anyParsing
                ? "Parsing JDs…"
                : parsedFiles.length > 0
                ? `${parsedFiles.length} of ${files.length} ready to preview`
                : "No files added yet"}
            </span>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
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
            <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => setView("upload")} disabled={saving}>
              Back
            </Button>
            <Button onClick={handleSaveAll} loading={saving} loadingText="Creating…">
              {`Create ${parsedFiles.length} job${parsedFiles.length !== 1 ? "s" : ""}`}
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
            aria-label="Choose JD documents to upload"
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
            className={`cursor-pointer select-none rounded-xl border-2 border-dashed p-8 text-center transition sm:p-10 ${
              isDragging ? "border-navy-500 bg-navy-50" : "border-line-strong hover:border-navy-400 hover:bg-surface"
            }`}
          >
            <Upload size={28} className={`mx-auto mb-3 ${isDragging ? "text-navy-600" : "text-muted"}`} />
            <p className="text-sm font-semibold text-ink">Drop JD documents here or click to browse</p>
            <p className="mt-1 text-xs text-muted">PDF, DOC, DOCX — multiple files supported</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

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
                        className="shrink-0 rounded-md p-1 text-muted hover:bg-danger-50 hover:text-danger-600"
                      >
                        <X size={14} />
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
          {parsedFiles.map((f, idx) => {
            const r = f.result!;
            const fid = (name: string) => `bulk-jd-${idx}-${name}`;
            return (
              <div key={f.file.name} className="space-y-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="shrink-0 text-navy-600" />
                  <span className="truncate text-xs font-medium text-muted">{f.file.name}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor={fid("title")} className="zh-label">Job title *</label>
                    <input
                      id={fid("title")}
                      type="text"
                      value={r.title}
                      onChange={(e) => updateResult(f.file.name, "title", e.target.value)}
                      className="zh-input"
                    />
                  </div>
                  <div>
                    <label htmlFor={fid("location")} className="zh-label">Location</label>
                    <input
                      id={fid("location")}
                      type="text"
                      value={r.location}
                      onChange={(e) => updateResult(f.file.name, "location", e.target.value)}
                      className="zh-input"
                    />
                  </div>
                  <div>
                    <label htmlFor={fid("client")} className="zh-label">Client (optional)</label>
                    <select
                      id={fid("client")}
                      value={r.client_id}
                      onChange={(e) => updateResult(f.file.name, "client_id", e.target.value)}
                      className="zh-input"
                    >
                      <option value="">No client</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={fid("exp-min")} className="zh-label">Experience min (yrs)</label>
                    <input
                      id={fid("exp-min")}
                      type="number"
                      min={0}
                      value={r.experience_min}
                      onChange={(e) => updateResult(f.file.name, "experience_min", Number(e.target.value))}
                      className="zh-input"
                    />
                  </div>
                  <div>
                    <label htmlFor={fid("exp-max")} className="zh-label">Experience max (yrs)</label>
                    <input
                      id={fid("exp-max")}
                      type="number"
                      min={0}
                      value={r.experience_max}
                      onChange={(e) => updateResult(f.file.name, "experience_max", Number(e.target.value))}
                      className="zh-input"
                    />
                  </div>
                  <div>
                    <label htmlFor={fid("work-mode")} className="zh-label">Work mode</label>
                    <select
                      id={fid("work-mode")}
                      value={r.work_mode}
                      onChange={(e) => updateResult(f.file.name, "work_mode", e.target.value)}
                      className="zh-input"
                    >
                      {workModes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={fid("priority")} className="zh-label">Priority</label>
                    <select
                      id={fid("priority")}
                      value={r.priority}
                      onChange={(e) => updateResult(f.file.name, "priority", e.target.value)}
                      className="zh-input"
                    >
                      {priorities.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={fid("skills")} className="zh-label">Skills (comma separated)</label>
                    <input
                      id={fid("skills")}
                      type="text"
                      value={r.mandatory_skills}
                      onChange={(e) => updateResult(f.file.name, "mandatory_skills", e.target.value)}
                      className="zh-input"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={fid("description")} className="zh-label">Description</label>
                    <textarea
                      id={fid("description")}
                      rows={3}
                      value={r.description}
                      onChange={(e) => updateResult(f.file.name, "description", e.target.value)}
                      className="zh-input resize-none"
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {overallError && (
            <p role="alert" className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{overallError}</p>
          )}
        </div>
      )}
    </Modal>
  );
}
