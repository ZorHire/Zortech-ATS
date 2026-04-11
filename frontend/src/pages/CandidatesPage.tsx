import { useState, useEffect } from "react";
import {
  Search,
  MapPin,
  Building2,
  Clock,
  Mail,
  Phone,
  Plus,
  UserCheck,
  ChevronDown,
  CheckSquare,
  Square,
  Send,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "../components/layout/Header";
import { Candidate } from "../types";
import api from "../lib/api";
import CandidateModal from "../components/candidates/CandidateModal";
import EmailCampaignModal from "../components/candidates/EmailCampaignModal";

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

const sourceBadgeColors: Record<string, string> = {
  linkedin: "bg-blue-50 text-blue-700",
  indeed: "bg-blue-50 text-blue-600",
  naukri: "bg-orange-50 text-orange-700",
  monster: "bg-purple-50 text-purple-700",
  vendor: "bg-teal-50 text-teal-700",
  referral: "bg-green-50 text-green-700",
  direct: "bg-gray-100 text-gray-600",
  other: "bg-gray-100 text-gray-600",
};

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [expFilter, setExpFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingCandidate, setViewingCandidate] = useState<Candidate | null>(
    null,
  );
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const navigate = useNavigate();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
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
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeParsing, setResumeParsing] = useState(false);
  const [resumeParseMessage, setResumeParseMessage] = useState("");
  const [resumeParseError, setResumeParseError] = useState("");

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      const data = await api.get("/candidates");
      setCandidates(data);
    } catch (error) {
      console.error("Fetch candidates error:", error);
    } finally {
      setLoading(false);
    }
  };

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
        (!parsed.name &&
          !parsed.email &&
          !parsed.phone &&
          (!parsed.skills || parsed.skills.length === 0))
      ) {
        console.error("Resume parse returned empty response", parsed);
        setResumeParseError("Could not extract meaningful data.");
        return;
      }

      console.log("Parsed resume response:", parsed);

      setFormData((current) => ({
        ...current,
        first_name: parsed.name?.split(" ")[0] || current.first_name,
        last_name:
          parsed.name?.split(" ").slice(1).join(" ") || current.last_name,
        email: parsed.email || current.email,
        phone: parsed.phone || current.phone,
        current_title: parsed.current_title || current.current_title,
        current_company: parsed.current_company || current.current_company,
        current_location: parsed.current_location || current.current_location,
        experience_years:
          parsed.experience_years !== undefined
            ? parsed.experience_years
            : current.experience_years,
        skills:
          parsed.skills?.length > 0 ? parsed.skills.join(", ") : current.skills,
      }));

      setResumeParseMessage(
        "Resume parsed successfully. Review fields and edit as needed.",
      );
    } catch (error) {
      console.error("Resume parse failed:", error);
      setResumeParseError("Could not extract data, please fill manually.");
    } finally {
      setResumeParsing(false);
    }
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();

      formDataToSend.append("first_name", formData.first_name);
      formDataToSend.append("last_name", formData.last_name);
      formDataToSend.append("email", formData.email);
      formDataToSend.append("phone", formData.phone);
      formDataToSend.append("current_title", formData.current_title);
      formDataToSend.append("current_company", formData.current_company);
      formDataToSend.append(
        "experience_years",
        String(formData.experience_years),
      );
      formDataToSend.append("current_location", formData.current_location);
      formDataToSend.append("source", formData.source);

      const skillsArray = formData.skills
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "");

      formDataToSend.append("skills", JSON.stringify(skillsArray));

      // 🔥 ADD FILE
      if (resumeFile) {
        formDataToSend.append("resume", resumeFile);
      }

      const newCandidate = await api.post("/candidates", formDataToSend);

      setCandidates([newCandidate, ...candidates]);
      setIsAddModalOpen(false);

      setFormData({
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
      });

      setResumeFile(null);
    } catch (error) {
      alert("Failed to add candidate");
    }
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((c) => c.id)));
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this candidate?"))
      return;
    try {
      await api.delete(`/candidates/${id}`);
      setCandidates(candidates.filter((c) => c.id !== id));
      if (viewingCandidate?.id === id) setViewingCandidate(null);
    } catch (error) {
      alert("Failed to delete candidate");
    }
  };

  const filtered = candidates.filter((c) => {
    const matchSearch = [
      c.first_name,
      c.last_name,
      c.current_title || "",
      c.current_company || "",
      ...c.skills,
    ].some((v) => v.toLowerCase().includes(search.toLowerCase()));
    const matchSource = sourceFilter === "all" || c.source === sourceFilter;
    const matchExp =
      expFilter === "all" ||
      (expFilter === "0-3" && c.experience_years <= 3) ||
      (expFilter === "3-7" &&
        c.experience_years > 3 &&
        c.experience_years <= 7) ||
      (expFilter === "7+" && c.experience_years > 7);
    return matchSearch && matchSource && matchExp;
  });

  const handleExportCSV = () => {
    if (filtered.length === 0) return;

    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Title",
      "Company",
      "Experience",
      "Location",
      "Skills",
      "Source",
    ];
    const csvContent = [
      headers.join(","),
      ...filtered.map((c) =>
        [
          c.first_name,
          c.last_name,
          c.email,
          c.phone || "",
          `"${c.current_title || ""}"`,
          `"${c.current_company || ""}"`,
          c.experience_years,
          `"${c.current_location || ""}"`,
          `"${c.skills.join(", ")}"`,
          c.source,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `candidates_export_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-gray-50/50">
      <Header
        title="Candidates"
        subtitle={`${candidates.length} total candidates · ${selectedIds.size} selected`}
        actions={
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <button
                onClick={() => setIsCampaignModalOpen(true)}
                className="flex items-center gap-2 bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50 transition-all shadow-sm"
              >
                <Send size={16} />
                Send Campaign
              </button>
            )}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              <Plus size={16} />
              Add Candidate
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search by name, skills, company, title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="appearance-none pl-4 pr-10 py-3 bg-gray-50 border border-transparent rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">All Sources</option>
                {Object.entries(sourceLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
            <div className="relative">
              <select
                value={expFilter}
                onChange={(e) => setExpFilter(e.target.value)}
                className="appearance-none pl-4 pr-10 py-3 bg-gray-50 border border-transparent rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">All Experience</option>
                <option value="0-3">0–3 years</option>
                <option value="3-7">3–7 years</option>
                <option value="7+">7+ years</option>
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-blue-600 transition-colors"
            >
              {selectedIds.size === filtered.length && filtered.length > 0 ? (
                <CheckSquare size={18} className="text-blue-600" />
              ) : (
                <Square size={18} />
              )}
              Select All
            </button>
            <p className="text-sm text-gray-400 font-medium">
              Showing{" "}
              <span className="text-gray-900 font-bold">{filtered.length}</span>{" "}
              candidates
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="text-xs font-bold px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
            >
              Export CSV
            </button>
            <button className="text-xs font-bold px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-all">
              AI Match to Job
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-2xl h-12 w-12 border-4 border-blue-600 border-t-transparent shadow-xl"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-4 text-gray-300">
              <UserCheck size={40} />
            </div>
            <p className="text-gray-900 font-bold text-lg">
              No candidates found
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((candidate) => (
              <div
                key={candidate.id}
                onClick={() => setViewingCandidate(candidate)}
                className={`bg-white border rounded-2xl p-5 hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer group relative overflow-hidden flex flex-col ${
                  selectedIds.has(candidate.id)
                    ? "border-blue-500 ring-2 ring-blue-500/10"
                    : "border-gray-100"
                }`}
              >
                <div
                  onClick={(e) => toggleSelect(candidate.id, e)}
                  className={`absolute top-4 left-4 z-10 p-1 rounded-lg transition-all ${
                    selectedIds.has(candidate.id)
                      ? "text-blue-600 opacity-100"
                      : "text-gray-300 opacity-0 group-hover:opacity-100 hover:text-blue-500"
                  }`}
                >
                  {selectedIds.has(candidate.id) ? (
                    <CheckSquare size={20} />
                  ) : (
                    <Square size={20} />
                  )}
                </div>

                <div className="flex flex-col items-center text-center mt-2 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-100 mb-3 group-hover:scale-105 transition-transform">
                    {candidate.first_name.charAt(0)}
                    {candidate.last_name.charAt(0)}
                  </div>
                  <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {candidate.first_name} {candidate.last_name}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-1 truncate w-full">
                    {candidate.current_title}
                  </p>
                </div>

                <div className="space-y-3 flex-1">
                  <div className="flex items-center justify-center gap-1.5 p-2 bg-gray-50 rounded-xl">
                    <Building2 size={13} className="text-gray-400" />
                    <span className="text-xs text-gray-600 font-bold truncate">
                      {candidate.current_company}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-blue-500" />
                      {candidate.current_location}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-emerald-500" />
                      {candidate.experience_years}y exp
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {candidate.skills.slice(0, 3).map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-1 bg-blue-50/50 text-blue-700 text-[10px] font-bold rounded-lg border border-blue-100/50"
                      >
                        {skill}
                      </span>
                    ))}
                    {candidate.skills.length > 3 && (
                      <span className="px-2 py-1 bg-gray-50 text-gray-400 text-[10px] font-bold rounded-lg">
                        +{candidate.skills.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-50 flex items-center justify-between">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${sourceBadgeColors[candidate.source]}`}
                  >
                    {sourceLabels[candidate.source]}
                  </span>
                  <div className="flex gap-1">
                    <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                      <Mail size={14} />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all">
                      <Phone size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-xl font-black text-[#111111] tracking-tight">
                Add New Candidate
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 hover:bg-white rounded-xl transition-all text-gray-400 hover:text-[#111111]"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddCandidate} className="p-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    First Name
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.first_name}
                    onChange={(e) =>
                      setFormData({ ...formData, first_name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    placeholder="e.g. John"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    Last Name
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.last_name}
                    onChange={(e) =>
                      setFormData({ ...formData, last_name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    placeholder="e.g. Doe"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    Email Address
                  </label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    placeholder="john.doe@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    Current Title
                  </label>
                  <input
                    type="text"
                    value={formData.current_title}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        current_title: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    placeholder="e.g. Senior Software Engineer"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    Current Company
                  </label>
                  <input
                    type="text"
                    value={formData.current_company}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        current_company: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    placeholder="e.g. Google"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    Skills (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={formData.skills}
                    onChange={(e) =>
                      setFormData({ ...formData, skills: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    placeholder="React, Node.js, TypeScript"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    Source
                  </label>
                  <select
                    value={formData.source}
                    onChange={(e) =>
                      setFormData({ ...formData, source: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none"
                  >
                    {Object.entries(sourceLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    Upload Resume
                  </label>

                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        setResumeFile(file);
                        parseResumeFile(file);
                      }
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {resumeFile && (
                    <p className="text-xs text-gray-500 mt-1">
                      Selected: {resumeFile.name}
                    </p>
                  )}

                  {resumeParsing && (
                    <p className="text-xs text-blue-600 mt-1">
                      Parsing resume, please wait...
                    </p>
                  )}
                  {resumeParseMessage && (
                    <p className="text-xs text-emerald-700 mt-1">
                      {resumeParseMessage}
                    </p>
                  )}
                  {resumeParseError && (
                    <p className="text-xs text-red-600 mt-1">
                      {resumeParseError}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-4 mt-10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-4 bg-gray-50 text-[#111111] font-black text-sm rounded-[20px] border border-gray-100 hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resumeParsing}
                  className="flex-1 py-4 bg-[#111111] text-white font-black text-sm rounded-[20px] hover:scale-[1.02] transition-all shadow-xl shadow-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resumeParsing ? "Parsing..." : "Create Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingCandidate && (
        <CandidateModal
          candidate={viewingCandidate}
          onClose={() => setViewingCandidate(null)}
          onUpdate={(updated) =>
            setCandidates(
              candidates.map((c) => (c.id === updated.id ? updated : c)),
            )
          }
          onDelete={handleDelete}
        />
      )}

      {isCampaignModalOpen && (
        <EmailCampaignModal
          candidates={Array.from(selectedIds)}
          onClose={() => setIsCampaignModalOpen(false)}
          onSend={(campaignId) => {
            console.log("Sending campaign", campaignId, "to", selectedIds);
            setIsCampaignModalOpen(false);
            setSelectedIds(new Set());
            alert("Emails sent successfully!");
          }}
        />
      )}
    </div>
  );
}
