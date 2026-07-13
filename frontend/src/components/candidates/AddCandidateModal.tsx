import { useState } from "react";
import { X } from "lucide-react";
import api from "../../lib/api";
import { isLowConfidence, confidenceInputClass, ConfidenceBadge } from "../../lib/confidenceIndicator";

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
  preferred_location: "",
  notice_period_days: 30,
  current_ctc: "",
  expected_ctc: "",
  skills: "",
  source: "direct",
};

export default function AddCandidateModal({ jobId, onClose, onSuccess }: Props) {
  const [formData, setFormData] = useState({ ...emptyForm });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeParsing, setResumeParsing] = useState(false);
  const [resumeParseMessage, setResumeParseMessage] = useState("");
  const [resumeParseError, setResumeParseError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lowConfidenceFields, setLowConfidenceFields] = useState<string[]>([]);

  const parseResumeFile = async (file: File) => {
    setResumeParsing(true);
    setResumeParseMessage("");
    setResumeParseError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const parsed = await api.post("/parse/resume", body);
      if (
        !parsed ||
        Object.keys(parsed).length === 0 ||
        (!parsed.name && !parsed.email && !parsed.phone && (!parsed.skills || parsed.skills.length === 0))
      ) {
        setResumeParseError("Could not auto-fill from this resume. Please fill in the fields manually.");
        return;
      }
      setFormData((cur) => ({
        ...cur,
        first_name: parsed.name?.split(" ")[0] || cur.first_name,
        last_name: parsed.name?.split(" ").slice(1).join(" ") || cur.last_name,
        email: parsed.email || cur.email,
        phone: parsed.phone || cur.phone,
        current_title: parsed.current_title || cur.current_title,
        current_company: parsed.current_company || cur.current_company,
        current_location: parsed.current_location || cur.current_location,
        experience_years: parsed.experience_years !== undefined ? parsed.experience_years : cur.experience_years,
        skills: parsed.skills?.length > 0 ? parsed.skills.join(", ") : cur.skills,
        preferred_location: parsed.preferred_location || cur.preferred_location,
        notice_period_days: parsed.notice_period_days !== undefined ? parsed.notice_period_days : cur.notice_period_days,
        current_ctc: parsed.current_ctc !== undefined ? String(parsed.current_ctc) : cur.current_ctc,
        expected_ctc: parsed.expected_ctc !== undefined ? String(parsed.expected_ctc) : cur.expected_ctc,
      }));
      setLowConfidenceFields(parsed.low_confidence_fields || []);
      setResumeParseMessage("Resume parsed successfully. Review fields and edit as needed.");
    } catch {
      setResumeParseError("Could not extract data, please fill manually.");
    } finally {
      setResumeParsing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim() && !formData.phone.trim()) {
      alert("Please provide at least an email or phone number.");
      return;
    }
    setSubmitting(true);
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
      fd.append("preferred_location", formData.preferred_location);
      fd.append("notice_period_days", String(formData.notice_period_days));
      if (formData.current_ctc) fd.append("current_ctc", formData.current_ctc);
      if (formData.expected_ctc) fd.append("expected_ctc", formData.expected_ctc);
      fd.append("source", formData.source);
      fd.append(
        "skills",
        JSON.stringify(formData.skills.split(",").map((s) => s.trim()).filter(Boolean)),
      );
      if (resumeFile) fd.append("resume", resumeFile);

      await api.post(`/jobs/${jobId}/candidates`, fd);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err?.data?.message || err?.message || "Failed to add candidate");
    } finally {
      setSubmitting(false);
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
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                First Name
                {isLowConfidence(lowConfidenceFields, "name") && <span className={ConfidenceBadge}>needs review</span>}
              </label>
              <input
                required
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all ${confidenceInputClass(isLowConfidence(lowConfidenceFields, "name"))}`}
                placeholder="e.g. John"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                Last Name
                {isLowConfidence(lowConfidenceFields, "name") && <span className={ConfidenceBadge}>needs review</span>}
              </label>
              <input
                required
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all ${confidenceInputClass(isLowConfidence(lowConfidenceFields, "name"))}`}
                placeholder="e.g. Doe"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                Email Address
                {isLowConfidence(lowConfidenceFields, "email") && <span className={ConfidenceBadge}>needs review</span>}
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all ${confidenceInputClass(isLowConfidence(lowConfidenceFields, "email"))}`}
                placeholder="john.doe@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                Phone Number
                {isLowConfidence(lowConfidenceFields, "phone") && <span className={ConfidenceBadge}>needs review</span>}
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all ${confidenceInputClass(isLowConfidence(lowConfidenceFields, "phone"))}`}
                placeholder="+91 XXXXX XXXXX"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                Current Title
                {isLowConfidence(lowConfidenceFields, "current_title") && <span className={ConfidenceBadge}>needs review</span>}
              </label>
              <input
                type="text"
                value={formData.current_title}
                onChange={(e) => setFormData({ ...formData, current_title: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all ${confidenceInputClass(isLowConfidence(lowConfidenceFields, "current_title"))}`}
                placeholder="e.g. Senior Software Engineer"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                Current Company
                {isLowConfidence(lowConfidenceFields, "current_company") && <span className={ConfidenceBadge}>needs review</span>}
              </label>
              <input
                type="text"
                value={formData.current_company}
                onChange={(e) => setFormData({ ...formData, current_company: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all ${confidenceInputClass(isLowConfidence(lowConfidenceFields, "current_company"))}`}
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
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                Location
                {isLowConfidence(lowConfidenceFields, "current_location") && <span className={ConfidenceBadge}>needs review</span>}
              </label>
              <input
                type="text"
                value={formData.current_location}
                onChange={(e) => setFormData({ ...formData, current_location: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all ${confidenceInputClass(isLowConfidence(lowConfidenceFields, "current_location"))}`}
                placeholder="e.g. New York"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                Preferred Location
                {isLowConfidence(lowConfidenceFields, "preferred_location") && <span className={ConfidenceBadge}>needs review</span>}
              </label>
              <input
                type="text"
                value={formData.preferred_location}
                onChange={(e) => setFormData({ ...formData, preferred_location: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all ${confidenceInputClass(isLowConfidence(lowConfidenceFields, "preferred_location"))}`}
                placeholder="e.g. Bangalore or Remote"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                Notice Period (days)
                {isLowConfidence(lowConfidenceFields, "notice_period_days") && <span className={ConfidenceBadge}>needs review</span>}
              </label>
              <input
                type="number"
                min={0}
                value={formData.notice_period_days}
                onChange={(e) => setFormData({ ...formData, notice_period_days: Number(e.target.value) })}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all ${confidenceInputClass(isLowConfidence(lowConfidenceFields, "notice_period_days"))}`}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                Current CTC (annual)
                {isLowConfidence(lowConfidenceFields, "current_ctc") && <span className={ConfidenceBadge}>needs review</span>}
              </label>
              <input
                type="number"
                min={0}
                value={formData.current_ctc}
                onChange={(e) => setFormData({ ...formData, current_ctc: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all ${confidenceInputClass(isLowConfidence(lowConfidenceFields, "current_ctc"))}`}
                placeholder="e.g. 1200000"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                Expected CTC (annual)
                {isLowConfidence(lowConfidenceFields, "expected_ctc") && <span className={ConfidenceBadge}>needs review</span>}
              </label>
              <input
                type="number"
                min={0}
                value={formData.expected_ctc}
                onChange={(e) => setFormData({ ...formData, expected_ctc: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all ${confidenceInputClass(isLowConfidence(lowConfidenceFields, "expected_ctc"))}`}
                placeholder="e.g. 1500000"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                Skills (comma separated)
                {isLowConfidence(lowConfidenceFields, "skills") && <span className={ConfidenceBadge}>needs review</span>}
              </label>
              <input
                type="text"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all ${confidenceInputClass(isLowConfidence(lowConfidenceFields, "skills"))}`}
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
