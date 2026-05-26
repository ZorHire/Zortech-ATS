import { useState, useEffect } from "react";
import {
  UserPlus, Shield, CheckCircle2, XCircle, RotateCcw, Search,
  ShieldCheck, UserCheck, ShieldAlert, SendHorizonal, Trash2,
  MoreHorizontal, ChevronLeft, ChevronRight,
} from "lucide-react";
import Header from "../components/layout/Header";
import api from "../lib/api";
import EmailToast from "../components/ui/EmailToast";

interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
}

const roleConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  super_admin: { label: "Super Admin", color: "bg-red-50 text-red-700", icon: ShieldAlert },
  accounts_manager: { label: "Accounts Mgr", color: "bg-blue-50 text-blue-700", icon: ShieldCheck },
  vendor_manager: { label: "Vendor Mgr", color: "bg-violet-50 text-violet-700", icon: UserCheck },
  recruiter: { label: "Recruiter", color: "bg-emerald-50 text-emerald-700", icon: UserPlus },
  vendor_user: { label: "Vendor", color: "bg-amber-50 text-amber-700", icon: Shield },
};

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin", accounts_manager: "Accounts Manager",
  vendor_manager: "Vendor Manager", recruiter: "Recruiter", vendor_user: "Vendor",
};

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const PAGE_SIZE = 15;

function RowMenu({ user, onReset, onToggle, onDelete }: {
  user: ManagedUser;
  onReset: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex items-center justify-end">
      <button onClick={() => setOpen((v) => !v)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-1">
            <button onClick={() => { setOpen(false); onReset(); }}
              className="w-full text-left px-3.5 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              <RotateCcw size={12} /> Reset Password
            </button>
            <button onClick={() => { setOpen(false); onToggle(); }}
              className={`w-full text-left px-3.5 py-2 text-xs flex items-center gap-2 ${user.is_active ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`}>
              {user.is_active ? <XCircle size={12} /> : <CheckCircle2 size={12} />}
              {user.is_active ? "Deactivate" : "Activate"}
            </button>
            <hr className="border-gray-100 my-0.5" />
            <button onClick={() => { setOpen(false); onDelete(); }}
              className="w-full text-left px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2">
              <Trash2 size={12} /> Delete User
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [newEmail, setNewEmail] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState("recruiter");
  const [newPassword, setNewPassword] = useState("");
  const [newVendorId, setNewVendorId] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [vendors, setVendors] = useState<{ id: string; company_name: string }[]>([]);
  const [emailToast, setEmailToast] = useState<{ message: string; type: "success" | "error"; showConfigLink?: boolean } | null>(null);

  const showEmailToast = (toast: typeof emailToast) => {
    setEmailToast(toast);
    setTimeout(() => setEmailToast(null), 4500);
  };

  useEffect(() => {
    fetchUsers();
    api.get("/vendors").then(setVendors).catch(() => {});
  }, []);

  const fetchUsers = async () => {
    try { const data = await api.get("/admin/users"); setUsers(data); }
    catch (error) { console.error("Fetch users error:", error); }
    finally { setLoading(false); }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true); setFormError("");
    try {
      const result = await api.post("/admin/users", {
        email: newEmail, full_name: newFullName, role: newRole, password: newPassword,
        ...(newRole === "vendor_user" && newVendorId ? { vendor_id: newVendorId } : {}),
      });
      setShowCreateModal(false);
      const capturedEmail = newEmail;
      resetForm(); fetchUsers();
      if (result.emailSent) showEmailToast({ message: `Invite email sent to ${capturedEmail}`, type: "success" });
      else if (result.emailError) showEmailToast({ message: result.emailError, type: "error", showConfigLink: result.emailError.includes("not configured") });
    } catch (err: any) { setFormError(err.message || "Failed to create user"); }
    finally { setFormLoading(false); }
  };

  const handleDeleteUser = async (user: ManagedUser) => {
    if (!window.confirm(`Permanently delete "${user.full_name || user.email}"?\n\nThis cannot be undone.`)) return;
    try { await api.delete(`/admin/users/${user.id}`); setUsers((prev) => prev.filter((u) => u.id !== user.id)); }
    catch (err: any) { alert(err?.message || "Failed to delete user."); }
  };

  const toggleUserStatus = async (user: ManagedUser) => {
    try { await api.patch(`/admin/users/${user.id}`, { is_active: !user.is_active }); fetchUsers(); }
    catch { alert("Failed to update user status"); }
  };

  const handleResetPassword = async (userId: string) => {
    const password = prompt("Enter new temporary password:");
    if (!password) return;
    try {
      await api.post(`/admin/users/${userId}/reset-password`, { newPassword: password });
      alert("Password reset successfully. User will be forced to change it on next login.");
      fetchUsers();
    } catch { alert("Failed to reset password"); }
  };

  const resetForm = () => {
    setNewEmail(""); setNewFullName(""); setNewRole("recruiter");
    setNewPassword(""); setNewVendorId(""); setFormError("");
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) || u.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginated = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = {
    total: users.length,
    active: users.filter((u) => u.is_active).length,
    inactive: users.filter((u) => !u.is_active).length,
    pending: users.filter((u) => u.must_change_password).length,
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="User Management" subtitle="Manage platform access and roles for your team"
        actions={
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#111111] text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-gray-200">
            <UserPlus size={15} /> Invite User
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Users</p>
            <p className="text-2xl font-black text-gray-900">{counts.total}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Active</p>
            <p className="text-2xl font-black text-emerald-600">{counts.active}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Inactive</p>
            <p className="text-2xl font-black text-gray-400">{counts.inactive}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Pending Reset</p>
            <p className="text-2xl font-black text-amber-600">{counts.pending}</p>
          </div>
        </div>

        {/* Search + Role filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by name or email…" value={searchTerm}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="relative">
            <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="appearance-none pl-3 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
              <option value="all">All Roles</option>
              {Object.entries(roleLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
            <ChevronLeft size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none rotate-[-90deg]" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : paginated.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <UserPlus size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-gray-500">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["User", "Role", "Status", "Password", "Actions"].map((h) => (
                      <th key={h} className={`px-5 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest ${h === "Actions" ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginated.map((user) => {
                    const rc = roleConfig[user.role] || roleConfig.recruiter;
                    const RoleIcon = rc.icon;
                    const initials = (user.full_name || user.email).charAt(0).toUpperCase();
                    return (
                      <tr key={user.id} className="hover:bg-gray-50/60 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl ${avatarColor(user.full_name || user.email)} text-white flex items-center justify-center font-bold text-sm flex-shrink-0`}>
                              {initials}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{user.full_name || "No Name"}</p>
                              <p className="text-xs text-gray-400">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${rc.color}`}>
                            <RoleIcon size={11} />
                            {rc.label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {user.is_active ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-gray-400 text-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {user.must_change_password ? (
                            <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded-full font-bold uppercase tracking-wide">Pending Reset</span>
                          ) : (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full font-bold uppercase tracking-wide">Verified</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <RowMenu user={user}
                            onReset={() => handleResetPassword(user.id)}
                            onToggle={() => toggleUserStatus(user)}
                            onDelete={() => handleDeleteUser(user)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
              <p className="text-xs text-gray-500">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} users
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
      </div>

      {emailToast && <EmailToast {...emailToast} />}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-7 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#111111] rounded-xl flex items-center justify-center text-white">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900">Invite New User</h2>
                  <p className="text-xs text-gray-400">User will be prompted to change password on first login</p>
                </div>
              </div>
              <button onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="p-2 hover:bg-white rounded-xl text-gray-400 hover:text-gray-700">
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-7 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex gap-2">
                  <Shield size={16} className="flex-shrink-0 mt-0.5" /> {formError}
                </div>
              )}

              {[
                { label: "Full Name", value: newFullName, onChange: setNewFullName, type: "text", placeholder: "John Doe", required: true },
                { label: "Email Address", value: newEmail, onChange: setNewEmail, type: "email", placeholder: "name@company.com", required: true },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{f.label}</label>
                  <input type={f.type} required={f.required} value={f.value} onChange={(e) => f.onChange(e.target.value)} placeholder={f.placeholder}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Role</label>
                <select value={newRole} onChange={(e) => { setNewRole(e.target.value); setNewVendorId(""); }}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                  {Object.entries(roleLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </div>

              {newRole === "vendor_user" && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Linked Vendor Company</label>
                  <select value={newVendorId} onChange={(e) => setNewVendorId(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                    <option value="">— Select vendor —</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
                  </select>
                  <p className="mt-1 text-[10px] text-gray-400">This vendor's assigned jobs will be visible to the user.</p>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Temporary Password</label>
                <input type="text" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Set a temporary password"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="flex-1 py-3 bg-gray-50 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-100 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={formLoading}
                  className="flex-1 py-3 bg-[#111111] text-white font-bold text-sm rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  {formLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><SendHorizonal size={15} /> Send Invite</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
