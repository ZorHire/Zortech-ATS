import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ArrowLeft, Upload, CheckCircle, AlertCircle, Loader } from "lucide-react";
import Header from "../components/layout/Header";
import api from "../lib/api";
import { Client } from "../types";

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "closed_filled", label: "Closed Filled" },
  { value: "closed_cancelled", label: "Closed Cancelled" },
];

export default function NewJobPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [jdParsing, setJdParsing] = useState(false);
  const [jdParseMessage, setJdParseMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    client_id: "",
    location: "",
    status: "draft",
    priority: "medium",
    work_mode: "onsite",
    employment_type: "full_time",
    experience_min: 0,
    experience_max: 3,
    salary_min: 0,
    salary_max: 0,
    headcount: 1,
    description: "",
    mandatory_skills: "",
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const data = await api.get("/clients");
      setClients(data);
    } catch (error) {
      console.error("Fetch clients error:", error);
    }
  };

  const handleJDUpload = async (file: File) => {
    setJdParsing(true);
    setJdParseMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const parsed = await api.post("/parse/jd", body);

      setFormData((current) => ({
        ...current,
        title: parsed.title || current.title,
        location: parsed.location || current.location,
        experience_min:
          parsed.experience_min !== undefined
            ? parsed.experience_min
            : current.experience_min,
        experience_max:
          parsed.experience_max !== undefined
            ? parsed.experience_max
            : current.experience_max,
        salary_min:
          parsed.salary_min !== undefined
            ? parsed.salary_min
            : current.salary_min,
        salary_max:
          parsed.salary_max !== undefined
            ? parsed.salary_max
            : current.salary_max,
        mandatory_skills:
          parsed.required_skills?.length > 0
            ? parsed.required_skills.join(", ")
            : current.mandatory_skills,
        description: parsed.description || current.description,
      }));

      setJdParseMessage({
        type: "success",
        text: "JD parsed successfully. Review fields and edit as needed.",
      });
    } catch (error) {
      console.error("JD parse failed:", error);
      setJdParseMessage({
        type: "error",
        text: "Could not extract data, please fill manually.",
      });
    } finally {
      setJdParsing(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api.post("/jobs", {
        ...formData,
        mandatory_skills: formData.mandatory_skills
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s !== ""),
      });
      navigate("/jobs");
    } catch (error: any) {
      alert(error?.data?.message || error?.message || "Unable to create job. Please verify all fields and try again.");
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Create Job Description"
        subtitle="Build a new JD and assign it to your hiring pipeline"
        actions={
          <button
            onClick={() => navigate("/jobs")}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Jobs
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl mx-auto overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
            <div className="p-3 bg-gray-100 rounded-2xl">
              <Plus size={18} className="text-[#111111]" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#111111] tracking-tight">
                New Job Description
              </h2>
              <p className="text-sm text-gray-500">
                Enter job details, skills, budget and publish status.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-8 grid grid-cols-1 gap-6 max-h-[75vh] overflow-y-auto"
          >
            {/* JD Upload → Auto-fill */}
            <div className="border border-dashed border-blue-200 bg-blue-50/40 rounded-2xl p-4">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                Upload JD to Auto-fill (PDF / DOCX / TXT)
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer px-4 py-2.5 bg-white border border-blue-200 rounded-xl text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-all shadow-sm">
                  {jdParsing ? (
                    <Loader size={15} className="animate-spin" />
                  ) : (
                    <Upload size={15} />
                  )}
                  {jdParsing ? "Parsing…" : "Choose File"}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    className="hidden"
                    disabled={jdParsing}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleJDUpload(file);
                    }}
                  />
                </label>
                {jdParseMessage && (
                  <span
                    className={`flex items-center gap-1.5 text-xs font-medium ${
                      jdParseMessage.type === "success"
                        ? "text-emerald-600"
                        : "text-red-500"
                    }`}
                  >
                    {jdParseMessage.type === "success" ? (
                      <CheckCircle size={13} />
                    ) : (
                      <AlertCircle size={13} />
                    )}
                    {jdParseMessage.text}
                  </span>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  Job Title
                </label>
                <input
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  placeholder="Senior Product Designer"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  Client
                </label>
                <select
                  required
                  value={formData.client_id}
                  onChange={(e) =>
                    setFormData({ ...formData, client_id: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                >
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  Location
                </label>
                <input
                  required
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  placeholder="Bangalore"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  Experience Min
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.experience_min}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      experience_min: Number(e.target.value),
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  Experience Max
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.experience_max}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      experience_max: Number(e.target.value),
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  Budget Min
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.salary_min}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      salary_min: Number(e.target.value),
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  Budget Max
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.salary_max}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      salary_max: Number(e.target.value),
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  Headcount
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.headcount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      headcount: Number(e.target.value),
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                Primary Skills
              </label>
              <input
                value={formData.mandatory_skills}
                onChange={(e) =>
                  setFormData({ ...formData, mandatory_skills: e.target.value })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                placeholder="React, Node.js, Product Management"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={6}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                placeholder="Provide core JD, responsibilities and must-have skills."
              />
            </div>

            <div className="flex gap-4 mt-6">
              <button
                type="button"
                onClick={() => navigate("/jobs")}
                className="flex-1 py-4 bg-gray-50 text-[#111111] font-black text-sm rounded-[20px] border border-gray-100 hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={jdParsing}
                className="flex-1 py-4 bg-[#111111] text-white font-black text-sm rounded-[20px] hover:scale-[1.02] transition-all shadow-xl shadow-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {jdParsing ? "Parsing JD…" : "Create Job"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
