import {
  Briefcase,
  Calendar,
  AlertTriangle,
  Plus,
  MoreHorizontal,
  LayoutGrid,
  Star,
} from "lucide-react";
import { useState, useEffect } from "react";
import Header from "../components/layout/Header";
import { useAuth } from "../contexts/AuthContext";
import { Job } from "../types";
import api from "../lib/api";
import DashboardModal from "../components/DashboardModal";
import DashboardCard from "../components/DashboardCard";

type CardType = "pipeline" | "jobs" | "interviews" | "alerts";

export default function DashboardPage() {
  useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeCard, setActiveCard] = useState<CardType | null>(null);

  const interviewItems = [
    {
      title: "Senior UX Interview",
      when: "Apr 12 · 11:00 AM",
      candidate: "Priya K.",
    },
    {
      title: "Backend Screening",
      when: "Apr 13 · 02:30 PM",
      candidate: "Rohit S.",
    },
    {
      title: "Client Review",
      when: "Apr 14 · 10:00 AM",
      candidate: "Nisha T.",
    },
  ];

  const slaAlerts = [
    { title: "Candidate response delay", severity: "High", status: "Pending" },
    {
      title: "Interview feedback overdue",
      severity: "Medium",
      status: "Action Required",
    },
    { title: "Offer approval pending", severity: "Low", status: "Monitoring" },
  ];

  const pipelineSummary = [
    { label: "Screening", count: 312 },
    { label: "Interview", count: 128 },
    { label: "Offer", count: 39 },
    { label: "Hired", count: 18 },
  ];

  const activeJobs = jobs.filter((j) => j.status === "active");

  const renderModalContent = () => {
    switch (activeCard) {
      case "pipeline":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {pipelineSummary.map((item) => (
                <div
                  key={item.label}
                  className="bg-slate-50 rounded-3xl p-4 border border-slate-100"
                >
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-3 text-2xl font-black text-slate-900">
                    {item.count}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                The pipeline is performing steadily with a high candidate flow
                into the screening stage.
              </p>
              <div className="rounded-3xl border border-slate-100 p-4 bg-slate-50">
                <h3 className="text-sm font-black text-slate-900 mb-3">
                  Stage overview
                </h3>
                <div className="space-y-3">
                  {pipelineSummary.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-sm text-slate-700">
                        {item.label}
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      case "jobs":
        return (
          <div className="space-y-4">
            {activeJobs.length === 0 ? (
              <p className="text-sm text-slate-500">
                No active jobs available right now.
              </p>
            ) : (
              <div className="space-y-4">
                {activeJobs.slice(0, 6).map((job) => (
                  <div
                    key={job.id}
                    className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          {job.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {job.department}
                        </p>
                      </div>
                      <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 rounded-full px-3 py-1">
                        {job.status}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-500">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {job.application_count || 0}
                        </p>
                        <p>Applications</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {job.location}
                        </p>
                        <p>Location</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case "interviews":
        return (
          <div className="space-y-4">
            {interviewItems.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"
              >
                <p className="text-sm font-black text-slate-900">
                  {item.title}
                </p>
                <p className="text-xs text-slate-500 mt-1">{item.candidate}</p>
                <p className="text-xs text-slate-400 mt-2">{item.when}</p>
              </div>
            ))}
          </div>
        );
      case "alerts":
        return (
          <div className="space-y-3">
            {slaAlerts.map((alert) => (
              <div
                key={alert.title}
                className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {alert.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {alert.status}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full ${
                      alert.severity === "High"
                        ? "bg-red-100 text-red-700"
                        : alert.severity === "Medium"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {alert.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  useEffect(() => {
    api
      .get("/jobs")
      .then(setJobs)
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Overview" subtitle="Recruitment Activity" />

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 pb-6 sm:pb-10 space-y-6 sm:space-y-10">
        {/* Main Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Portfolio Style Large Card */}
          <button
            type="button"
            onClick={() => setActiveCard("pipeline")}
            className="lg:col-span-6 bg-[#E3F2FF] rounded-[28px] sm:rounded-[40px] p-5 sm:p-8 flex flex-col justify-between relative overflow-hidden min-h-[220px] sm:min-h-[240px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
          >
            <div className="relative z-10 text-left">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base sm:text-lg font-black text-[#111111] tracking-tight">
                  Active Pipeline
                </h3>
                <span className="text-gray-400">
                  <MoreHorizontal size={20} />
                </span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl sm:text-4xl font-black text-[#111111] tracking-tighter">
                  1,247
                </span>
                <span className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-widest">
                  Candidates
                </span>
              </div>
              <p className="text-xs font-bold text-gray-400 mt-1">
                Total active sourcing pool
              </p>
            </div>

            <div className="relative h-20 mt-4">
              <svg
                className="w-full h-full"
                viewBox="0 0 400 100"
                preserveAspectRatio="none"
              >
                <path
                  d="M0,80 Q50,70 100,85 T200,60 T300,75 T400,40"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="350" cy="55" r="5" fill="#3B82F6" />
                <rect
                  x="320"
                  y="20"
                  width="60"
                  height="25"
                  rx="12"
                  fill="#111111"
                />
                <text
                  x="350"
                  y="37"
                  textAnchor="middle"
                  className="text-[10px] font-bold fill-white"
                >
                  87% Match
                </text>
              </svg>
            </div>

            <div className="flex flex-wrap gap-3 sm:gap-4 mt-4">
              {["1H", "24H", "1W", "1M", "1Y", "ALL"].map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`text-[10px] font-black ${t === "1W" ? "text-[#111111]" : "text-gray-400"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </button>

          {/* Your Assets Style Grid */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="col-span-full mb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-[#111111] tracking-tight">
                  Quick Stats
                </h3>
                <button className="p-2 bg-gray-50 rounded-xl border border-gray-100">
                  <MoreHorizontal size={16} className="text-gray-400" />
                </button>
              </div>
            </div>
            <DashboardCard
              icon={Briefcase}
              label="Active Jobs"
              value={activeJobs.length}
              description="Open jobs currently recruiting"
              color="text-[#6366F1]"
              bgColor="bg-[#EBE9FE]"
              onClick={() => setActiveCard("jobs")}
            />
            <DashboardCard
              icon={Calendar}
              label="Interviews"
              value="14"
              description="Scheduled interviews"
              color="text-[#10B981]"
              bgColor="bg-[#E1F7EF]"
              onClick={() => setActiveCard("interviews")}
            />
            <DashboardCard
              icon={AlertTriangle}
              label="SLA Alerts"
              value="02"
              description="Pending alerts"
              color="text-[#F59E0B]"
              bgColor="bg-[#FEF3C7]"
              onClick={() => setActiveCard("alerts")}
            />
          </div>
        </div>

        {/* Lower Grid Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-6 sm:gap-10">
          {/* Market Style Table */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-7 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-lg sm:text-xl font-black text-[#111111] tracking-tight">
                Job Market{" "}
                <span className="text-gray-300 ml-2 text-sm sm:text-base font-bold uppercase tracking-widest">
                  is up 2.4%
                </span>
              </h3>
              <div className="flex gap-2">
                <select className="text-[10px] font-black bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 uppercase tracking-widest outline-none">
                  <option>24h</option>
                </select>
                <select className="text-[10px] font-black bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 uppercase tracking-widest outline-none">
                  <option>Top gainers</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="hidden sm:grid grid-cols-12 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <div className="col-span-6">Position</div>
                <div className="col-span-2 text-right">Candidates</div>
                <div className="col-span-2 text-right">Match Rate</div>
                <div className="col-span-2 text-right px-2">Action</div>
              </div>

              <div className="space-y-2">
                {activeJobs.slice(0, 4).map((job, idx) => (
                  <div
                    key={job.id}
                    className="grid grid-cols-1 sm:grid-cols-12 items-center p-4 hover:bg-gray-50 rounded-3xl transition-all group gap-3 sm:gap-0"
                  >
                    <div className="sm:col-span-6 flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-[18px] bg-[#111111] flex items-center justify-center text-white font-black text-lg">
                        {job.title.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#111111] truncate">
                          {job.title}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {job.department}
                        </p>
                      </div>
                    </div>
                    <div className="sm:col-span-2 sm:text-right">
                      <p className="text-sm font-black text-[#111111]">
                        {job.application_count}
                      </p>
                    </div>
                    <div className="sm:col-span-2 sm:text-right">
                      <p className="text-sm font-black text-emerald-500">
                        +{80 + idx * 5}%
                      </p>
                    </div>
                    <div className="sm:col-span-2 flex sm:justify-end px-2">
                      <button className="text-gray-300 hover:text-amber-400 transition-colors">
                        <Star size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Banner Style Card */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-5">
            <div className="bg-[#111111] rounded-[28px] sm:rounded-[40px] p-6 sm:p-10 h-full flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-[-20%] right-[-10%] w-64 h-64 border-[1px] border-white/10 rounded-full" />
              <div className="absolute bottom-[-10%] left-[-10%] w-48 h-48 border-[1px] border-white/5 rounded-full" />

              <div className="relative z-10 space-y-6">
                <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  Optimize{" "}
                  <span className="inline-block px-3 py-1 bg-white/10 rounded-full italic font-serif">
                    Sourcing
                  </span>{" "}
                  with ZorHire AI
                </h2>
                <p className="text-sm font-medium text-gray-500 leading-relaxed">
                  Automate your candidate outreach and matching with
                  enterprise-grade intelligence.
                </p>
              </div>

              <div className="relative z-10 mt-10">
                <button className="bg-[#E3F2FF] text-[#111111] px-8 py-4 rounded-[20px] font-black text-sm hover:scale-105 transition-transform shadow-xl shadow-blue-500/10">
                  Upgrade Now
                </button>
              </div>

              {/* Graphic Element */}
              <div className="absolute bottom-6 right-10 opacity-20">
                <LayoutGrid
                  size={120}
                  className="text-white"
                  strokeWidth={0.5}
                />
              </div>
            </div>
          </div>
        </div>
        {activeCard && (
          <DashboardModal
            title={
              activeCard === "pipeline"
                ? "Active Pipeline"
                : activeCard === "jobs"
                  ? "Active Jobs"
                  : activeCard === "interviews"
                    ? "Upcoming Interviews"
                    : "SLA Alerts"
            }
            subtitle="Tap outside or use the close button to dismiss"
            onClose={() => setActiveCard(null)}
          >
            {renderModalContent()}
          </DashboardModal>
        )}
      </div>
    </div>
  );
}
