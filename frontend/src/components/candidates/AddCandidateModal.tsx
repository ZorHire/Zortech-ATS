import { useState } from "react";
import { X } from "lucide-react";
import { useParseResumeMutation, useAddCandidateToJobMutation } from "../../store/api/candidateApi";

interface Props {
  jobId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const sourceLabels: Record<string, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  naukri: "Naukri",
  monster: "Monster",
  vendor: "Vendor",
  referral: "Referral",
  direct: "Direct",
  other: "Other",
};

const emptyForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  current_title: "",
  current_company: "",
  experience_years: 0,
  current_location: "",
  skills: "",
  source: "direct",
};

export default function AddCandidateModal({ jobId, onClose, onSuccess }: Props) {
  const [formData, setFormData] = useState({ ...emptyForm });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeParseMessage, setResumeParseMessage] = useState("");
  const [resumeParseError, setResumeParseError] = useState("");

  const [parseResume, { isLoading: resumeParsing }] = useParseResumeMutation();
  const [addCandidateToJob, { isLoading: submitting }] = useAddCandidateToJobMutation();

  const parseResumeFile = async (file: File) => {
    setResumeParseMessage("");
    setResumeParseError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const parsed = await parseResume(body).unwrap();
      if (
        !parsed ||
        Object.keys(parsed).length === 0 ||
        (!(parsed as any).name && !(parsed as any).email && !(parsed as any).phone &&
          (!(parsed as any).skills || (parsed as any).skills.length === 0))
      ) {
        setResumeParseError("Could not auto-fill from this resume. Please fill in the fields manually.");
        return;
      }
      const p = parsed as any;
      setFormData((cur) => ({
        ...cur,
        first_name: p.name?.split(" ")[0] || cur.first_name,
        last_name: p.name?.split(" ").slice(1).join(" ") || cur.last_name,
        email: p.email || cur.email,
        phone: p.phone || cur.phone,
        current_title: p.current_title || cur.current_title,
        current_company: p.current_company || cur.current_company,
        current_location: p.current_location || cur.current_location,
        experience_years: p.experience_years !== undefined ? p.experience_years : cur.experience_years,
        skills: p.skills?.length > 0 ? p.skills.join(", ") : cur.skills,
      }));
      setResumeParseMessage("Resume parsed successfully. Review fields and edit as needed.");
    } catch {
      setResumeParseError("Could not extract data, please fill manually.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim() && !formData.phone.trim()) {
      alert("Please provide at least an email or phone number.");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("first_name", formData.first_name);
      fd.append("last_name", formData.last_name);
      fd.append("email", formData.email);
      fd.append("phone", formData.phone);
      fd.append("current_title", formData.current_title);
      fd.append("current_company", formData.current_company);
      fd.append("experience_years", String(formData.experience_years));
      fd.append("current_location", formData.current_location);
      fd.append("source", formData.source);
      fd.append(
        "skills",
        JSON.stringify(formData.skills.split(",").map((s) => s.trim()).filter(Boolean)),
      );
      if (resumeFile) fd.append("resume", resumeFile);

      await addCandidateToJob({ jobId, body: fd }).unwrap();
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err?.data?.message || err?.message || "Failed to add candidate");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-xl font-black text-[#111111] tracking-tight">Add Candidate to Job</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-xl transition-all text-gray-400 hover:text-[#111111]"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto max-h-[75vh]">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">First Name</label>
              <input
                required
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                placeholder="e.g. John"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Last Name</label>
              <input
                required
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                placeholder="e.g. Doe"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                placeholder="john.doe@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                placeholder="+91 XXXXX XXXXX"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Current Title</label>
              <input
                type="text"
                value={formData.current_title}
                onChange={(e) => setFormData({ ...formData, current_title: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                placeholder="e.g. Senior Software Engineer"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Current Company</label>
              <input
                type="text"
                value={formData.current_company}
                onChange={(e) => setFormData({ ...formData, current_company: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                placeholder="e.g. Google"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Experience (years)</label>
              <input
                type="number"
                min={0}
                value={formData.experience_years}
                onChange={(e) => setFormData({ ...formData, experience_years: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Location</label>
              <input
                type="text"
                value={formData.current_location}
                onChange={(e) => setFormData({ ...formData, current_location: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                placeholder="e.g. New York"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Skills (comma separated)</label>
              <input
                type="text"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                placeholder="React, Node.js, TypeScript"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Source</label>
              <div className="relative">
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full px-4 py-3 pr-10 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none"
                >
                  {Object.entries(sourceLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Upload Resume</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    const file = e.target.files[0];
                    setResumeFile(file);
                    parseResumeFile(file);
                  }
                }}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {resumeFile && <p className="text-xs text-gray-500 mt-1">Selected: {resumeFile.name}</p>}
              {resumeParsing && <p className="text-xs text-blue-600 mt-1">Parsing resume, please wait...</p>}
              {resumeParseMessage && <p className="text-xs text-emerald-700 mt-1">{resumeParseMessage}</p>}
              {resumeParseError && <p className="text-xs text-red-600 mt-1">{resumeParseError}</p>}
            </div>
          </div>
          <div className="flex gap-4 mt-10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-gray-50 text-[#111111] font-black text-sm rounded-[20px] border border-gray-100 hover:bg-gray-100 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resumeParsing || submitting}
              className="flex-1 py-4 bg-[#111111] text-white font-black text-sm rounded-[20px] hover:scale-[1.02] transition-all shadow-xl shadow-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resumeParsing ? "Parsing..." : submitting ? "Adding..." : "Add to Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
