import {
  Briefcase,
  Calendar,
  AlertTriangle,
  MoreHorizontal,
  LayoutGrid,
  Star,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "../components/layout/Header";
import { useAuth } from "../contexts/AuthContext";
import { Job } from "../types";
import api from "../lib/api";
import DashboardModal from "../components/DashboardModal";
import DashboardCard from "../components/DashboardCard";

type CardType = "pipeline" | "jobs" | "interviews" | "alerts";

interface DashboardStats {
  active_jobs: number;
  total_candidates: number;
  upcoming_interviews: number;
  sla_alerts: number;
  pipeline_stages: { stage: string; count: number }[];
}

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  sourced: "Sourced",
  screened: "Screened",
  shortlisted: "Shortlisted",
  submitted_to_client: "Submitted to Client",
  client_interview_scheduled: "Interview Scheduled",
  interview_completed: "Interview Completed",
  selected: "Selected",
  offer_extended: "Offer Extended",
  offer_accepted: "Offer Accepted",
  offer_rejected: "Offer Rejected",
  joined: "Joined",
  disqualified: "Disqualified",
};

export default function DashboardPage() {
  useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeCard, setActiveCard] = useState<CardType | null>(null);

  const activeJobs = jobs.filter((j) => j.status === "active");

  useEffect(() => {
    const fetchAll = () => {
      api.get("/jobs").then(setJobs).catch(() => {});
      api.get("/dashboard/stats").then(setStats).catch(() => {});
    };
    fetchAll();
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, []);

  const fmt = (n: number | undefined) =>
    n !== undefined ? n.toLocaleString("en-IN") : "—";

  const renderModalContent = () => {
    switch (activeCard) {
      case "pipeline": {
        const stages = stats?.pipeline_stages ?? [];
        const total = stages.reduce((s, r) => s + r.count, 0);
        if (stages.length === 0) {
          return (
            <p className="text-sm text-slate-500 py-4 text-center">
              No pipeline data yet. Applications will appear here once candidates are added.
            </p>
          );
        }
        return (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Stage</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">Candidates</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map((row) => (
                    <tr key={row.stage} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {STAGE_LABELS[row.stage] ?? row.stage}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {row.count.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50">
                    <td className="px-4 py-3 font-black text-slate-900 text-[13px]">Total</td>
                    <td className="px-4 py-3 text-right font-black text-slate-900 text-[13px]">
                      {total.toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      }

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

      case "interviews": {
        const count = stats?.upcoming_interviews ?? 0;
        return (
          <div className="text-center py-4 space-y-2">
            <p className="text-3xl font-black text-slate-900">
              {count.toLocaleString("en-IN")}
            </p>
            <p className="text-sm text-slate-500">
              {count === 0
                ? "No upcoming interviews scheduled."
                : `${count} interview${count > 1 ? "s" : ""} scheduled and awaiting.`}
            </p>
          </div>
        );
      }

      case "alerts": {
        const count = stats?.sla_alerts ?? 0;
        return (
          <div className="text-center py-4 space-y-2">
            <p className={`text-3xl font-black ${count > 0 ? "text-amber-500" : "text-slate-900"}`}>
              {count.toLocaleString("en-IN")}
            </p>
            <p className="text-sm text-slate-500">
              {count === 0
                ? "All jobs are within SLA. No alerts at this time."
                : `${count} active job${count > 1 ? "s have" : " has"} breached their SLA deadline. Review on the Jobs page.`}
            </p>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Overview" subtitle="Recruitment Activity" />

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 pb-6 sm:pb-10 space-y-6 sm:space-y-10">
        {/* Main Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Active Pipeline Card */}
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
                  {fmt(stats?.total_candidates)}
                </span>
                <span className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-widest">
                  Candidates
                </span>
              </div>
              <p className="text-xs font-bold text-gray-400 mt-1">
                Total candidates in your talent pool
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
              </svg>
            </div>

            <div className="flex flex-wrap gap-3 sm:gap-4 mt-4">
              {["1H", "24H", "1W", "1M", "1Y", "ALL"].map((t) => (
                <span
                  key={t}
                  className={`text-[10px] font-black ${t === "1W" ? "text-[#111111]" : "text-gray-400"}`}
                >
                  {t}
                </span>
              ))}
            </div>
          </button>

          {/* Quick Stats */}
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
              value={stats ? stats.active_jobs : activeJobs.length}
              description="Open jobs currently recruiting"
              color="text-[#6366F1]"
              bgColor="bg-[#EBE9FE]"
              onClick={() => setActiveCard("jobs")}
            />
            <DashboardCard
              icon={Calendar}
              label="Interviews"
              value={stats ? fmt(stats.upcoming_interviews) : "—"}
              description="Scheduled interviews"
              color="text-[#10B981]"
              bgColor="bg-[#E1F7EF]"
              onClick={() => setActiveCard("interviews")}
            />
            <DashboardCard
              icon={AlertTriangle}
              label="SLA Alerts"
              value={stats ? fmt(stats.sla_alerts) : "—"}
              description="Overdue SLA deadlines"
              color="text-[#F59E0B]"
              bgColor="bg-[#FEF3C7]"
              onClick={() => setActiveCard("alerts")}
            />
          </div>
        </div>

        {/* Lower Grid Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-6 sm:gap-10">
          {/* Job List Table */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-7 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-lg sm:text-xl font-black text-[#111111] tracking-tight">
                Active Jobs
              </h3>
            </div>

            <div className="space-y-4">
              <div className="hidden sm:grid grid-cols-12 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <div className="col-span-6">Position</div>
                <div className="col-span-2 text-right">Applications</div>
                <div className="col-span-2 text-right">Location</div>
                <div className="col-span-2 text-right px-2">Save</div>
              </div>

              <div className="space-y-2">
                {activeJobs.length === 0 ? (
                  <p className="text-sm text-gray-400 px-4 py-6 text-center">
                    No active jobs yet.
                  </p>
                ) : (
                  activeJobs.slice(0, 4).map((job) => (
                    <div
                      key={job.id}
                      className="grid grid-cols-1 sm:grid-cols-12 items-center p-4 hover:bg-gray-50 rounded-3xl transition-all group gap-3 sm:gap-0"
                    >
                      <div className="sm:col-span-6 flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-[18px] bg-[#111111] flex items-center justify-center text-white font-black text-lg flex-shrink-0">
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
                          {job.application_count ?? 0}
                        </p>
                      </div>
                      <div className="sm:col-span-2 sm:text-right">
                        <p className="text-sm text-gray-500 truncate">
                          {job.location ?? "—"}
                        </p>
                      </div>
                      <div className="sm:col-span-2 flex sm:justify-end px-2">
                        <button className="text-gray-300 hover:text-amber-400 transition-colors">
                          <Star size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Upgrade Banner */}
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
                <Link
                  to="/pricing"
                  className="inline-block bg-[#E3F2FF] text-[#111111] px-8 py-4 rounded-[20px] font-black text-sm hover:scale-105 transition-transform shadow-xl shadow-blue-500/10"
                >
                  Upgrade Now
                </Link>
              </div>

              <div className="absolute bottom-6 right-10 opacity-20">
                <LayoutGrid size={120} className="text-white" strokeWidth={0.5} />
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
