import { useState, useRef, useCallback } from "react";
import {
  X, Upload, FileText, CheckCircle2, XCircle, Loader2,
  ChevronDown, ArrowLeft, Eye,
} from "lucide-react";
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

  const anyParsing = files.some((f) => f.status === "parsing");

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
                  ? "Bulk Resume Upload"
                  : `Preview — ${parsedFiles.length} Candidate${parsedFiles.length !== 1 ? "s" : ""}`}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {view === "upload"
                  ? "Drop multiple resumes to import all at once"
                  : "Review and edit parsed info before saving"}
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
                  isDragging ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-400 hover:bg-gray-50"
                }`}
              >
                <Upload size={28} className={`mx-auto mb-3 ${isDragging ? "text-blue-500" : "text-gray-400"}`} />
                <p className="text-sm font-semibold text-gray-700">Drop resumes here or click to browse</p>
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

              {/* Optional JD assignment */}
              {jobs.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Assign to Job (optional)
                  </label>
                  <div className="relative">
                    <select
                      value={selectedJobId}
                      onChange={(e) => setSelectedJobId(e.target.value)}
                      className="w-full px-4 py-3 pr-10 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                    >
                      <option value="">No assignment — add to candidate pool only</option>
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title}{(j as any).client?.name ? ` — ${(j as any).client.name}` : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

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
              {parsedFiles.map((f) => (
                <div key={f.file.name} className="border border-gray-100 rounded-2xl p-5 bg-gray-50/40 space-y-4">
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-blue-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-gray-500 truncate">{f.file.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        ["First Name", "first_name"],
                        ["Last Name", "last_name"],
                        ["Email", "email"],
                        ["Phone", "phone"],
                        ["Current Title", "current_title"],
                        ["Company", "current_company"],
                        ["Experience (yrs)", "experience_years"],
                        ["Location", "current_location"],
                      ] as [string, string][]
                    ).map(([label, field]) => (
                      <div key={field}>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          {label}
                        </label>
                        <input
                          type={field === "experience_years" ? "number" : "text"}
                          value={f.result?.[field] as string ?? ""}
                          onChange={(e) => updateResult(f.file.name, field, e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                        Skills (comma separated)
                      </label>
                      <input
                        type="text"
                        value={f.result?.skills as string ?? ""}
                        onChange={(e) => updateResult(f.file.name, "skills", e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                        Source
                      </label>
                      <div className="relative">
                        <select
                          value={f.result?.source as string ?? "direct"}
                          onChange={(e) => updateResult(f.file.name, "source", e.target.value)}
                          className="w-full px-3 py-2 pr-8 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                        >
                          {Object.entries(sourceLabels).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
                  ? "Parsing resumes…"
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
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
                className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-all"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving
                  ? "Saving…"
                  : `Save ${parsedFiles.length} Candidate${parsedFiles.length !== 1 ? "s" : ""}`}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
