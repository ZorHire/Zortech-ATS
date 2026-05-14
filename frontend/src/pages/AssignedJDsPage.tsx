import { useState, useEffect } from "react";
import {
  ClipboardList,
  Search,
  X,
  Loader2,
  Users,
  Building2,
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

interface RecruiterInfo {
  id: string;
  full_name: string;
  email: string;
}

interface VendorInfo {
  id: string;
  company_name: string;
}

export default function AssignedJDsPage() {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<AssignedJob[]>([]);
  const [recruiters, setRecruiters] = useState<RecruiterInfo[]>([]);
  const [vendors, setVendors] = useState<VendorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  const canManageRecruiters =
    profile?.role === "super_admin" || profile?.role === "accounts_manager";
  const canManageVendors =
    profile?.role === "super_admin" ||
    profile?.role === "vendor_manager" ||
    profile?.role === "accounts_manager";

  useEffect(() => {
    Promise.all([
      api.get("/jobs"),
      canManageRecruiters ? api.get("/admin/users") : Promise.resolve([]),
      canManageVendors ? api.get("/vendors") : Promise.resolve([]),
    ])
      .then(([jobsData, usersData, vendorsData]) => {
        setJobs(jobsData as AssignedJob[]);
        setRecruiters(
          (usersData as any[])
            .filter((u: any) => u.role === "recruiter")
            .map((u: any) => ({
              id: u.id,
              full_name: u.full_name || u.email,
              email: u.email,
            })),
        );
        setVendors(
          (vendorsData as any[]).map((v: any) => ({
            id: v.id,
            company_name: v.company_name,
          })),
        );
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
      const newIds = (job.assigned_recruiter_ids ?? []).filter(
        (id) => id !== recruiterId,
      );
      await api.patch(`/jobs/${jobId}`, { assigned_recruiter_ids: newIds });
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId ? { ...j, assigned_recruiter_ids: newIds } : j,
        ),
      );
    } catch (err) {
      console.error("Failed to remove recruiter assignment:", err);
    } finally {
      setRemoving(null);
    }
  };

  const removeVendor = async (jobId: string, vendorId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    const key = `${jobId}-v-${vendorId}`;
    setRemoving(key);
    try {
      const newIds = (job.assigned_vendor_ids ?? []).filter(
        (id) => id !== vendorId,
      );
      await api.patch(`/jobs/${jobId}`, { assigned_vendor_ids: newIds });
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId ? { ...j, assigned_vendor_ids: newIds } : j,
        ),
      );
    } catch (err) {
      console.error("Failed to remove vendor assignment:", err);
    } finally {
      setRemoving(null);
    }
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
    const hasAssignment =
      (j.assigned_recruiter_ids?.length ?? 0) > 0 ||
      (j.assigned_vendor_ids?.length ?? 0) > 0;
    if (!hasAssignment) return false;
    if (!search) return true;
    return j.title.toLowerCase().includes(search.toLowerCase());
  });

  const statusColor = (s: string) => {
    if (s === "active") return "bg-emerald-50 text-emerald-700";
    if (s === "draft") return "bg-gray-100 text-gray-600";
    return "bg-blue-50 text-blue-700";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="JD Assignments" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Search */}
        <div className="relative mb-6">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search by job title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading assignments…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No assigned JDs found.</p>
            <p className="text-xs mt-1 text-gray-300">
              Use the Assign JD button on the Vendors page to make assignments.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
              >
                {/* Job header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">
                      {job.title}
                    </h3>
                  </div>
                  <span
                    className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(job.status)}`}
                  >
                    {job.status}
                  </span>
                </div>

                {/* Recruiters section */}
                {canManageRecruiters &&
                  (job.assigned_recruiter_ids?.length ?? 0) > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Users size={12} className="text-blue-500" />
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                          Recruiters
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {job.assigned_recruiter_ids.map((rid) => (
                          <span
                            key={rid}
                            className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 bg-blue-50 border border-blue-100 rounded-full text-xs text-blue-800 font-medium"
                          >
                            {getRecruiterLabel(rid)}
                            <button
                              onClick={() => removeRecruiter(job.id, rid)}
                              disabled={removing === `${job.id}-r-${rid}`}
                              title="Remove assignment"
                              className="p-0.5 rounded-full hover:bg-blue-200 transition-colors disabled:opacity-40"
                            >
                              {removing === `${job.id}-r-${rid}` ? (
                                <Loader2 size={9} className="animate-spin" />
                              ) : (
                                <X size={9} />
                              )}
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Vendors section */}
                {canManageVendors &&
                  (job.assigned_vendor_ids?.length ?? 0) > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Building2 size={12} className="text-violet-500" />
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                          Vendors
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {job.assigned_vendor_ids.map((vid) => (
                          <span
                            key={vid}
                            className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 bg-violet-50 border border-violet-100 rounded-full text-xs text-violet-800 font-medium"
                          >
                            {getVendorLabel(vid)}
                            <button
                              onClick={() => removeVendor(job.id, vid)}
                              disabled={removing === `${job.id}-v-${vid}`}
                              title="Remove assignment"
                              className="p-0.5 rounded-full hover:bg-violet-200 transition-colors disabled:opacity-40"
                            >
                              {removing === `${job.id}-v-${vid}` ? (
                                <Loader2 size={9} className="animate-spin" />
                              ) : (
                                <X size={9} />
                              )}
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
