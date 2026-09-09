import { useState, useRef, useCallback } from "react";
import {
  X, Upload, FileText, CheckCircle2, XCircle, Loader2,
  ChevronDown, ArrowLeft, Eye,
} from "lucide-react";
import { useParseJdMutation, useCreateJobMutation, useGetClientsQuery } from "../../store/api/jobApi";

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
    if (status === "parsing" || status === "saving")
      return <Loader2 size={14} className="text-blue-500 animate-spin flex-shrink-0" />;
    if (status === "parsed" || status === "saved")
      return <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />;
    if (status === "error")
      return <XCircle size={14} className="text-red-500 flex-shrink-0" />;
    return <FileText size={14} className="text-gray-400 flex-shrink-0" />;
  };

  const statusBadge = (f: UploadFile) => {
    const map: Record<FileStatus, { label: string; cls: string }> = {
      pending: { label: "Pending", cls: "bg-gray-100 text-gray-500" },
      parsing: { label: "Parsing…", cls: "bg-blue-50 text-blue-600" },
      parsed: { label: "Ready", cls: "bg-emerald-50 text-emerald-600" },
      error: { label: f.error || "Error", cls: "bg-red-50 text-red-600" },
      saving: { label: "Saving…", cls: "bg-blue-50 text-blue-600" },
      saved: { label: "Saved", cls: "bg-emerald-50 text-emerald-700" },
    };
    const { label, cls } = map[f.status];
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            {view === "preview" && (
              <button
                onClick={() => setView("upload")}
                className="p-1.5 hover:bg-white rounded-lg text-gray-500 hover:text-gray-800 transition-all"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">
                {view === "upload"
                  ? "Bulk JD Upload"
                  : `Preview — ${parsedFiles.length} Job${parsedFiles.length !== 1 ? "s" : ""}`}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {view === "upload"
                  ? "Upload multiple JD documents to create jobs at once"
                  : "Review parsed job details before creating"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-xl text-gray-400 hover:text-gray-700 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {view === "upload" ? (
            <div className="p-8 space-y-6">

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all select-none ${
                  isDragging ? "border-violet-500 bg-violet-50" : "border-gray-200 hover:border-violet-400 hover:bg-gray-50"
                }`}
              >
                <Upload size={28} className={`mx-auto mb-3 ${isDragging ? "text-violet-500" : "text-gray-400"}`} />
                <p className="text-sm font-semibold text-gray-700">Drop JD documents here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX — multiple files supported</p>
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
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {files.length} file{files.length !== 1 ? "s" : ""} selected
                  </p>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {files.map((f) => (
                      <div key={f.file.name} className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
                        {statusIcon(f.status)}
                        <span className="flex-1 text-sm text-gray-700 truncate">{f.file.name}</span>
                        {statusBadge(f)}
                        {f.status !== "parsing" && (
                          <button
                            onClick={() => removeFile(f.file.name)}
                            className="text-gray-400 hover:text-red-500 ml-1 flex-shrink-0"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          ) : (
            // Preview view
            <div className="p-8 space-y-4">
              {parsedFiles.map((f) => {
                const r = f.result!;
                return (
                  <div key={f.file.name} className="border border-gray-100 rounded-2xl p-5 bg-gray-50/40 space-y-4">
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="text-violet-500 flex-shrink-0" />
                      <span className="text-xs font-semibold text-gray-500 truncate">{f.file.name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Job Title *
                        </label>
                        <input
                          type="text"
                          value={r.title}
                          onChange={(e) => updateResult(f.file.name, "title", e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Location
                        </label>
                        <input
                          type="text"
                          value={r.location}
                          onChange={(e) => updateResult(f.file.name, "location", e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Client (optional)
                        </label>
                        <div className="relative">
                          <select
                            value={r.client_id}
                            onChange={(e) => updateResult(f.file.name, "client_id", e.target.value)}
                            className="w-full px-3 py-2 pr-8 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 appearance-none"
                          >
                            <option value="">No client</option>
                            {clients.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Exp Min (yrs)
                        </label>
                        <input
                          type="number" min={0}
                          value={r.experience_min}
                          onChange={(e) => updateResult(f.file.name, "experience_min", Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Exp Max (yrs)
                        </label>
                        <input
                          type="number" min={0}
                          value={r.experience_max}
                          onChange={(e) => updateResult(f.file.name, "experience_max", Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Work Mode
                        </label>
                        <div className="relative">
                          <select
                            value={r.work_mode}
                            onChange={(e) => updateResult(f.file.name, "work_mode", e.target.value)}
                            className="w-full px-3 py-2 pr-8 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 appearance-none"
                          >
                            {workModes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Priority
                        </label>
                        <div className="relative">
                          <select
                            value={r.priority}
                            onChange={(e) => updateResult(f.file.name, "priority", e.target.value)}
                            className="w-full px-3 py-2 pr-8 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 appearance-none"
                          >
                            {priorities.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Skills (comma separated)
                        </label>
                        <input
                          type="text"
                          value={r.mandatory_skills}
                          onChange={(e) => updateResult(f.file.name, "mandatory_skills", e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Description
                        </label>
                        <textarea
                          rows={3}
                          value={r.description}
                          onChange={(e) => updateResult(f.file.name, "description", e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {overallError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{overallError}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0 bg-gray-50/30">
          {view === "upload" ? (
            <>
              <span className="text-xs text-gray-400">
                {anyParsing
                  ? "Parsing JDs…"
                  : parsedFiles.length > 0
                  ? `${parsedFiles.length} of ${files.length} ready to preview`
                  : "No files added yet"}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setView("preview")}
                  disabled={parsedFiles.length === 0 || anyParsing}
                  className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Eye size={14} /> Preview ({parsedFiles.length})
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setView("upload")}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-all"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-all"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving
                  ? "Creating…"
                  : `Create ${parsedFiles.length} Job${parsedFiles.length !== 1 ? "s" : ""}`}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
