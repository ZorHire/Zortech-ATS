import { useState, useEffect } from "react";
import {
  ClipboardList, Search, X, Loader2, Users, Building2,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import Header from "../components/layout/Header";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

interface AssignedJob {
  id: string;
  title: string;
  status: string;
  assigned_recruiter_ids: string[];
  assigned_vendor_ids: string[];
}

interface RecruiterInfo { id: string; full_name: string; email: string; }
interface VendorInfo { id: string; company_name: string; }

const PAGE_SIZE = 15;

const statusConfig: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  draft: "bg-gray-100 text-gray-600",
  pending_review: "bg-amber-50 text-amber-700",
  on_hold: "bg-slate-100 text-slate-600",
  closed_filled: "bg-blue-50 text-blue-700",
  closed_cancelled: "bg-red-50 text-red-600",
};

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AssignedJDsPage() {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<AssignedJob[]>([]);
  const [recruiters, setRecruiters] = useState<RecruiterInfo[]>([]);
  const [vendors, setVendors] = useState<VendorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const canManageRecruiters = profile?.role === "super_admin" || profile?.role === "accounts_manager";
  const canManageVendors = profile?.role === "super_admin" || profile?.role === "vendor_manager" || profile?.role === "accounts_manager";

  useEffect(() => {
    Promise.all([
      api.get("/jobs"),
      canManageRecruiters ? api.get("/admin/users") : Promise.resolve([]),
      canManageVendors ? api.get("/vendors") : Promise.resolve([]),
    ])
      .then(([jobsData, usersData, vendorsData]) => {
        setJobs(jobsData as AssignedJob[]);
        setRecruiters((usersData as any[]).filter((u: any) => u.role === "recruiter").map((u: any) => ({ id: u.id, full_name: u.full_name || u.email, email: u.email })));
        setVendors((vendorsData as any[]).map((v: any) => ({ id: v.id, company_name: v.company_name })));
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeRecruiter = async (jobId: string, recruiterId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    const key = `${jobId}-r-${recruiterId}`;
    setRemoving(key);
    try {
      const newIds = (job.assigned_recruiter_ids ?? []).filter((id) => id !== recruiterId);
      await api.patch(`/jobs/${jobId}`, { assigned_recruiter_ids: newIds });
      setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, assigned_recruiter_ids: newIds } : j));
    } catch (err) { console.error("Failed to remove recruiter assignment:", err); }
    finally { setRemoving(null); }
  };

  const removeVendor = async (jobId: string, vendorId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    const key = `${jobId}-v-${vendorId}`;
    setRemoving(key);
    try {
      const newIds = (job.assigned_vendor_ids ?? []).filter((id) => id !== vendorId);
      await api.patch(`/jobs/${jobId}`, { assigned_vendor_ids: newIds });
      setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, assigned_vendor_ids: newIds } : j));
    } catch (err) { console.error("Failed to remove vendor assignment:", err); }
    finally { setRemoving(null); }
  };

  const getRecruiterLabel = (id: string) => {
    const r = recruiters.find((r) => r.id === id);
    return r ? r.full_name || r.email : id.slice(0, 8) + "…";
  };

  const getVendorLabel = (id: string) => {
    const v = vendors.find((v) => v.id === id);
    return v ? v.company_name : id.slice(0, 8) + "…";
  };

  const filtered = jobs.filter((j) => {
    const hasAssignment = (j.assigned_recruiter_ids?.length ?? 0) > 0 || (j.assigned_vendor_ids?.length ?? 0) > 0;
    if (!hasAssignment) return false;
    if (!search) return true;
    return j.title.toLowerCase().includes(search.toLowerCase());
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalAssigned = filtered.length;
  const totalRecruiterLinks = filtered.reduce((s, j) => s + (j.assigned_recruiter_ids?.length ?? 0), 0);
  const totalVendorLinks = filtered.reduce((s, j) => s + (j.assigned_vendor_ids?.length ?? 0), 0);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="JD Assignments" subtitle="Track which jobs are assigned to recruiters and vendors" />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Assigned JDs</p>
            <p className="text-2xl font-black text-gray-900">{totalAssigned}</p>
            <p className="text-xs text-gray-400 mt-0.5">with active assignments</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Recruiter Links</p>
            <p className="text-2xl font-black text-blue-600">{totalRecruiterLinks}</p>
            <p className="text-xs text-gray-400 mt-0.5">across all jobs</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Vendor Links</p>
            <p className="text-2xl font-black text-violet-600">{totalVendorLinks}</p>
            <p className="text-xs text-gray-400 mt-0.5">across all jobs</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by job title…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading assignments…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <ClipboardList size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-semibold text-gray-500">No assigned JDs found</p>
            <p className="text-xs mt-1 text-gray-400">Use the Assign JD button on the Vendors page to make assignments.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Job Title</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                    {canManageRecruiters && (
                      <th className="px-5 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assigned Recruiters</th>
                    )}
                    {canManageVendors && (
                      <th className="px-5 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assigned Vendors</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginated.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50/60 transition-colors align-top">
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-gray-900 max-w-[220px] truncate">{job.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {(job.assigned_recruiter_ids?.length ?? 0) + (job.assigned_vendor_ids?.length ?? 0)} assignment{((job.assigned_recruiter_ids?.length ?? 0) + (job.assigned_vendor_ids?.length ?? 0)) !== 1 ? "s" : ""}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusConfig[job.status] || "bg-gray-100 text-gray-600"}`}>
                          {statusLabel(job.status)}
                        </span>
                      </td>
                      {canManageRecruiters && (
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {(job.assigned_recruiter_ids?.length ?? 0) === 0 ? (
                              <span className="text-xs text-gray-300">—</span>
                            ) : job.assigned_recruiter_ids.map((rid) => (
                              <span key={rid}
                                className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-blue-50 border border-blue-100 rounded-full text-xs text-blue-800 font-medium">
                                <Users size={10} className="text-blue-400" />
                                {getRecruiterLabel(rid)}
                                <button onClick={() => removeRecruiter(job.id, rid)} disabled={removing === `${job.id}-r-${rid}`}
                                  className="ml-0.5 p-0.5 rounded-full hover:bg-blue-200 transition-colors disabled:opacity-40">
                                  {removing === `${job.id}-r-${rid}` ? <Loader2 size={9} className="animate-spin" /> : <X size={9} />}
                                </button>
                              </span>
                            ))}
                          </div>
                        </td>
                      )}
                      {canManageVendors && (
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {(job.assigned_vendor_ids?.length ?? 0) === 0 ? (
                              <span className="text-xs text-gray-300">—</span>
                            ) : job.assigned_vendor_ids.map((vid) => (
                              <span key={vid}
                                className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-violet-50 border border-violet-100 rounded-full text-xs text-violet-800 font-medium">
                                <Building2 size={10} className="text-violet-400" />
                                {getVendorLabel(vid)}
                                <button onClick={() => removeVendor(job.id, vid)} disabled={removing === `${job.id}-v-${vid}`}
                                  className="ml-0.5 p-0.5 rounded-full hover:bg-violet-200 transition-colors disabled:opacity-40">
                                  {removing === `${job.id}-v-${vid}` ? <Loader2 size={9} className="animate-spin" /> : <X size={9} />}
                                </button>
                              </span>
                            ))}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
                <p className="text-xs text-gray-500">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-30">
                    <ChevronLeft size={15} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold ${page === p ? "bg-[#111111] text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                      {p}
                    </button>
                  ))}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-30">
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
