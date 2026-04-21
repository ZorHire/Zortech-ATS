import { useState, useEffect } from "react";
import {
  UserPlus,
  Shield,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCheck,
  ShieldAlert,
  SendHorizonal,
  Trash2,
} from "lucide-react";
import Header from "../components/layout/Header";
import api from "../lib/api";
import { useSendEmail } from "../hooks/useSendEmail";
import EmailToast from "../components/ui/EmailToast";

interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
}

export default function AdminPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearch] = useState("");

  // Form state
  const [newEmail, setNewEmail] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState("recruiter");
  const [newPassword, setNewPassword] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const { sendEmail, sending, emailToast } = useSendEmail();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await api.get("/admin/users");
      setUsers(data);
    } catch (error) {
      console.error("Fetch users error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    try {
      await api.post("/admin/users", {
        email: newEmail,
        full_name: newFullName,
        role: newRole,
        password: newPassword,
      });

      // Close modal and refresh list before sending email
      setShowCreateModal(false);
      const capturedName = newFullName;
      const capturedEmail = newEmail;
      const capturedPassword = newPassword;
      const capturedRole = roleLabels[newRole] || newRole;
      resetForm();
      fetchUsers();

      // Send invite email with credentials
      await sendEmail(capturedEmail, {
        firstName: capturedName.split(" ")[0] || capturedName,
        subject: "You've been invited to ZorHire",
        body: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e">
            <h2 style="color:#2563eb;margin-bottom:8px">Welcome to ZorHire!</h2>
            <p>Hi <strong>${capturedName || capturedEmail}</strong>,</p>
            <p>Your account has been created. Here are your login credentials:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:8px">
              <tr>
                <td style="padding:10px 14px;font-weight:600;color:#64748b;width:40%">Email</td>
                <td style="padding:10px 14px;color:#1e293b">${capturedEmail}</td>
              </tr>
              <tr style="background:#f1f5f9">
                <td style="padding:10px 14px;font-weight:600;color:#64748b">Temporary Password</td>
                <td style="padding:10px 14px;color:#1e293b;font-family:monospace">${capturedPassword}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;font-weight:600;color:#64748b">Role</td>
                <td style="padding:10px 14px;color:#1e293b">${capturedRole}</td>
              </tr>
            </table>
            <p style="color:#ef4444;font-size:13px">You will be required to change your password upon first login.</p>
            <p style="margin-top:24px;font-size:13px;color:#94a3b8">If you have any questions, contact your administrator.</p>
          </div>
        `,
      });
    } catch (err: any) {
      setFormError(err.message || "Failed to create user");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (user: ManagedUser) => {
    if (
      !window.confirm(
        `Permanently delete "${user.full_name || user.email}"?\n\nThis cannot be undone. All data for this user will be removed.`,
      )
    )
      return;

    try {
      await api.delete(`/admin/users/${user.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err: any) {
      alert(err?.message || "Failed to delete user.");
    }
  };

  const toggleUserStatus = async (user: ManagedUser) => {
    try {
      await api.patch(`/admin/users/${user.id}`, {
        is_active: !user.is_active,
      });
      fetchUsers();
    } catch (error) {
      alert("Failed to update user status");
    }
  };

  const handleResetPassword = async (userId: string) => {
    const password = prompt("Enter new temporary password:");
    if (!password) return;
    try {
      await api.post(`/admin/users/${userId}/reset-password`, {
        newPassword: password,
      });
      alert(
        "Password reset successfully. User will be forced to change it on next login.",
      );
      fetchUsers();
    } catch (error) {
      alert("Failed to reset password");
    }
  };

  const resetForm = () => {
    setNewEmail("");
    setNewFullName("");
    setNewRole("recruiter");
    setNewPassword("");
    setFormError("");
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const roleLabels: Record<string, string> = {
    super_admin: "Super Admin",
    ats_admin: "Accounts Manager",
    vendor_manager: "Vendor Manager",
    recruiter: "Recruiter",
  };

  const roleIcons: Record<string, any> = {
    super_admin: ShieldAlert,
    ats_admin: ShieldCheck,
    vendor_manager: UserCheck,
    recruiter: UserPlus,
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-gray-50/50">
      <Header
        title="User Management"
        subtitle="Manage platform access and roles for your team"
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            <UserPlus size={18} />
            Invite User
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats & Search */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Total Users
            </p>
            <p className="text-2xl font-bold text-gray-900">{users.length}</p>
          </div>
          <div className="md:col-span-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
            <Search size={20} className="text-gray-400 ml-2" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Password
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-gray-500 font-medium"
                    >
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const RoleIcon = roleIcons[user.role] || UserPlus;
                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-gray-50/50 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                              {user.full_name
                                ? user.full_name.charAt(0)
                                : user.email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">
                                {user.full_name || "No Name"}
                              </p>
                              <p className="text-xs text-gray-500">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg w-fit">
                            <RoleIcon size={14} className="text-gray-500" />
                            <span className="text-xs font-bold">
                              {roleLabels[user.role] || user.role}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {user.is_active ? (
                            <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                              <CheckCircle2 size={14} /> Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-red-500 text-xs font-bold">
                              <XCircle size={14} /> Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {user.must_change_password ? (
                            <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-100 uppercase">
                              Pending Reset
                            </span>
                          ) : (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-100 uppercase">
                              Verified
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleResetPassword(user.id)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Reset Password"
                            >
                              <RotateCcw size={16} />
                            </button>
                            <button
                              onClick={() => toggleUserStatus(user)}
                              className={`p-2 rounded-lg transition-all ${user.is_active ? "text-gray-400 hover:text-red-600 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50"}`}
                              title={user.is_active ? "Deactivate" : "Activate"}
                            >
                              {user.is_active ? (
                                <XCircle size={16} />
                              ) : (
                                <CheckCircle2 size={16} />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete User"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Email send toast */}
      {emailToast && <EmailToast {...emailToast} />}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-50/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Invite New User
                  </h2>
                  <p className="text-xs text-gray-500 font-medium">
                    User will be forced to change password
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-white rounded-xl transition-all text-gray-400 hover:text-gray-600"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex gap-2">
                  <Shield size={16} className="flex-shrink-0" />
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="name@company.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                  Assigned Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(roleLabels).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                  Temporary Password
                </label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Set a temporary password"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 bg-gray-50 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading || sending}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {formLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <SendHorizonal size={16} />
                      Send Invite
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
