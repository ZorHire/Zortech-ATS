import { useId, useState } from "react";
import {
  UserPlus, Shield, CheckCircle2, XCircle, RotateCcw, Search,
  ShieldCheck, UserCheck, ShieldAlert, SendHorizonal, Trash2,
  ChevronLeft, ChevronRight, Eye, EyeOff, Users, KeyRound,
} from "lucide-react";
import EmailToast from "../components/ui/EmailToast";
import {
  Badge, Button, DataTable, EmptyState, Modal, PageHeader, StatCard, useConfirm,
} from "../components/ui";
import type { BadgeTone, Column } from "../components/ui";
import { useNotify } from "../hooks/useNotify";
import { getErrorMessage } from "../lib/format";
import {
  useGetUsersQuery, useInviteUserMutation, useDeleteUserMutation,
  useToggleUserStatusMutation, useResetUserPasswordMutation,
  type ManagedUser,
} from "../store/api/adminApi";
import { useGetVendorsQuery } from "../store/api/vendorApi";

/** Role → badge tone, short label and icon (one mapping for the page). */
const roleConfig: Record<string, { label: string; tone: BadgeTone; icon: React.ElementType }> = {
  super_admin: { label: "Super Admin", tone: "danger", icon: ShieldAlert },
  accounts_manager: { label: "Accounts Mgr", tone: "navy", icon: ShieldCheck },
  vendor_manager: { label: "Vendor Mgr", tone: "info", icon: UserCheck },
  recruiter: { label: "Recruiter", tone: "success", icon: UserPlus },
  vendor_user: { label: "Vendor", tone: "brand", icon: Shield },
};

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin", accounts_manager: "Accounts Manager",
  vendor_manager: "Vendor Manager", recruiter: "Recruiter", vendor_user: "Vendor",
};

const AVATAR_COLORS = [
  "bg-navy-600 text-white", "bg-brand-500 text-ink", "bg-navy-400 text-white",
  "bg-brand-200 text-brand-900", "bg-navy-800 text-white", "bg-navy-100 text-navy-800",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const PAGE_SIZE = 15;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Password field with a show/hide toggle. */
function PasswordInput({
  id, value, onChange, placeholder, invalid, describedBy, autoFocus,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        data-autofocus={autoFocus ? true : undefined}
        className="zh-input pr-11"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted hover:text-ink"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="mt-1 text-xs text-danger-600">{message}</p>;
}

type FieldErrors = Partial<Record<"full_name" | "email" | "password", string>>;

export default function AdminPage() {
  const notify = useNotify();
  const confirm = useConfirm();
  const ids = useId();

  const { data: users = [], isLoading: loading, isError, error, refetch } = useGetUsersQuery();
  const { data: vendors = [] } = useGetVendorsQuery();
  const [inviteUser, { isLoading: formLoading }] = useInviteUserMutation();
  const [deleteUser] = useDeleteUserMutation();
  const [toggleUserStatusMutation] = useToggleUserStatusMutation();
  const [resetUserPassword, { isLoading: resetting }] = useResetUserPasswordMutation();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [newEmail, setNewEmail] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState("recruiter");
  const [newPassword, setNewPassword] = useState("");
  const [newVendorId, setNewVendorId] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [emailToast, setEmailToast] = useState<{ message: string; type: "success" | "error"; showConfigLink?: boolean } | null>(null);

  const [resetUser, setResetUser] = useState<ManagedUser | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [resetError, setResetError] = useState("");

  const showEmailToast = (toast: typeof emailToast) => {
    setEmailToast(toast);
    setTimeout(() => setEmailToast(null), 4500);
  };

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!newFullName.trim()) errs.full_name = "Enter the user's full name.";
    if (!newEmail.trim()) errs.email = "Enter an email address.";
    else if (!EMAIL_RE.test(newEmail.trim())) errs.email = "Enter a valid email address.";
    if (!newPassword) errs.password = "Set a temporary password.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;
    try {
      const result = (await inviteUser({
        email: newEmail, full_name: newFullName, role: newRole, password: newPassword,
        ...(newRole === "vendor_user" && newVendorId ? { vendor_id: newVendorId } : {}),
      }).unwrap()) as ManagedUser & { emailSent?: boolean; emailError?: string };
      setShowCreateModal(false);
      const capturedEmail = newEmail;
      resetForm();
      if (result.emailSent) {
        showEmailToast({ message: `User created — invite sent to ${capturedEmail}`, type: "success" });
      } else if (result.emailError) {
        showEmailToast({ message: `User created. Invite email failed — ${result.emailError}`, type: "error", showConfigLink: true });
      } else {
        showEmailToast({ message: `User created successfully`, type: "success" });
      }
    } catch (err) { setFormError(getErrorMessage(err, "Failed to create user")); }
  };

  const handleDeleteUser = async (user: ManagedUser) => {
    const ok = await confirm({
      title: `Delete ${user.full_name || user.email}?`,
      message: "This permanently removes the user and cannot be undone.",
      confirmText: "Delete user",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteUser(user.id).unwrap();
      notify.success("User deleted");
    } catch (err) { notify.error(getErrorMessage(err, "Failed to delete user.")); }
  };

  const handleToggleStatus = async (user: ManagedUser) => {
    try {
      await toggleUserStatusMutation({ id: user.id, is_active: !user.is_active }).unwrap();
      notify.success(user.is_active ? "User deactivated" : "User activated");
    } catch { notify.error("Failed to update user status"); }
  };

  const openReset = (user: ManagedUser) => {
    setResetUser(user);
    setResetPwd("");
    setResetError("");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser) return;
    if (!resetPwd) { setResetError("Enter a temporary password."); return; }
    try {
      await resetUserPassword({ userId: resetUser.id, newPassword: resetPwd }).unwrap();
      setResetUser(null);
      notify.success("Password reset. The user must change it on next login.");
    } catch { notify.error("Failed to reset password"); }
  };

  const resetForm = () => {
    setNewEmail(""); setNewFullName(""); setNewRole("recruiter");
    setNewPassword(""); setNewVendorId(""); setFormError(""); setFieldErrors({});
  };

  const closeCreate = () => { setShowCreateModal(false); resetForm(); };

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

  const columns: Column<ManagedUser>[] = [
    {
      key: "user",
      header: "User",
      cell: (user) => (
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${avatarColor(user.full_name || user.email)}`} aria-hidden="true">
            {(user.full_name || user.email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-ink">{user.full_name || "No name"}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (user) => {
        const rc = roleConfig[user.role] || roleConfig.recruiter;
        const RoleIcon = rc.icon;
        return <Badge tone={rc.tone} icon={<RoleIcon size={11} aria-hidden="true" />}>{rc.label}</Badge>;
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (user) =>
        user.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>,
    },
    {
      key: "password",
      header: "Password",
      cell: (user) =>
        user.must_change_password ? <Badge tone="warning">Pending reset</Badge> : <Badge tone="success">Verified</Badge>,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right whitespace-nowrap",
      cell: (user) => {
        const name = user.full_name || user.email;
        return (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => openReset(user)}
              aria-label={`Reset password for ${name}`}
              title="Reset password"
              className="rounded-lg p-2 text-muted hover:bg-surface-sunken hover:text-ink"
            >
              <RotateCcw size={15} />
            </button>
            <button
              type="button"
              onClick={() => handleToggleStatus(user)}
              aria-label={`${user.is_active ? "Deactivate" : "Activate"} ${name}`}
              title={user.is_active ? "Deactivate" : "Activate"}
              className={`rounded-lg p-2 hover:bg-surface-sunken ${user.is_active ? "text-warning-600" : "text-success-600"}`}
            >
              {user.is_active ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
            </button>
            <button
              type="button"
              onClick={() => handleDeleteUser(user)}
              aria-label={`Delete ${name}`}
              title="Delete user"
              className="rounded-lg p-2 text-danger-600 hover:bg-danger-50"
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      },
    },
  ];

  const fid = (k: string) => `${ids}-${k}`;
  const hasFilters = !!searchTerm || roleFilter !== "all";

  return (
    <>
      <PageHeader
        title="User management"
        subtitle="Manage platform access and roles for your team"
        actions={
          <Button icon={<UserPlus size={16} />} onClick={() => setShowCreateModal(true)}>
            Invite user
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total users" value={counts.total} icon={<Users size={18} />} tone="navy" loading={loading} />
          <StatCard label="Active" value={counts.active} icon={<CheckCircle2 size={18} />} tone="success" loading={loading} />
          <StatCard label="Inactive" value={counts.inactive} icon={<XCircle size={18} />} tone="neutral" loading={loading} />
          <StatCard label="Pending reset" value={counts.pending} icon={<KeyRound size={18} />} tone="brand" loading={loading} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor={fid("search")} className="sr-only">Search users</label>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input id={fid("search")} type="search" placeholder="Search by name or email…" value={searchTerm}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="zh-input pl-9" />
          </div>
          <div className="sm:w-56">
            <label htmlFor={fid("role-filter")} className="sr-only">Filter by role</label>
            <select id={fid("role-filter")} value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="zh-input cursor-pointer">
              <option value="all">All roles</option>
              {Object.entries(roleLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <DataTable
            caption="Users"
            columns={columns}
            rows={isError ? undefined : paginated}
            rowKey={(u) => u.id}
            loading={loading}
            error={isError ? error : undefined}
            onRetry={refetch}
            empty={
              hasFilters ? (
                <EmptyState
                  icon={<Search size={22} aria-hidden="true" />}
                  title="No users match"
                  description="Try a different name, email or role."
                  action={<Button variant="secondary" onClick={() => { setSearch(""); setRoleFilter("all"); setPage(1); }}>Clear filters</Button>}
                />
              ) : (
                <EmptyState
                  icon={<UserPlus size={22} aria-hidden="true" />}
                  title="No users yet"
                  description="Invite your team to give them access."
                  action={<Button icon={<UserPlus size={16} />} onClick={() => setShowCreateModal(true)}>Invite user</Button>}
                />
              )
            }
          />

          {totalPages > 1 && (
            <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-2 sm:flex-row">
              <p className="text-xs text-muted">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} users
              </p>
              <div className="flex flex-wrap items-center gap-1">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  aria-label="Previous page"
                  className="rounded-lg p-1.5 text-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-30">
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} type="button" onClick={() => setPage(p)}
                    aria-current={page === p ? "page" : undefined}
                    className={`h-8 w-8 rounded-lg text-xs font-semibold ${page === p ? "bg-navy-600 text-white" : "text-ink-soft hover:bg-surface-sunken"}`}>
                    {p}
                  </button>
                ))}
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  aria-label="Next page"
                  className="rounded-lg p-1.5 text-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-30">
                  <ChevronRight size={15} />
                </button>
              </div>
            </nav>
          )}
        </div>
      </div>

      {emailToast && <EmailToast {...emailToast} />}

      {/* Invite user */}
      <Modal
        open={showCreateModal}
        onClose={closeCreate}
        preventClose={formLoading}
        title="Invite new user"
        description="The user will be prompted to change the password on first login."
        footer={
          <>
            <Button variant="secondary" onClick={closeCreate} disabled={formLoading}>Cancel</Button>
            <Button type="submit" form={fid("invite-form")} loading={formLoading} icon={<SendHorizonal size={15} />}>
              Send invite
            </Button>
          </>
        }
      >
        <form id={fid("invite-form")} onSubmit={handleCreateUser} noValidate className="space-y-4">
          {formError && (
            <div role="alert" className="flex gap-2 rounded-lg border border-danger-600/20 bg-danger-50 p-3 text-sm text-danger-700">
              <Shield size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" /> {formError}
            </div>
          )}

          <div>
            <label htmlFor={fid("name")} className="zh-label">Full name</label>
            <input id={fid("name")} type="text" autoComplete="off" value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)} placeholder="John Doe"
              aria-invalid={!!fieldErrors.full_name || undefined}
              aria-describedby={fieldErrors.full_name ? fid("name-err") : undefined}
              className="zh-input" />
            <FieldError id={fid("name-err")} message={fieldErrors.full_name} />
          </div>

          <div>
            <label htmlFor={fid("email")} className="zh-label">Email address</label>
            <input id={fid("email")} type="email" autoComplete="off" value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)} placeholder="name@company.com"
              aria-invalid={!!fieldErrors.email || undefined}
              aria-describedby={fieldErrors.email ? fid("email-err") : undefined}
              className="zh-input" />
            <FieldError id={fid("email-err")} message={fieldErrors.email} />
          </div>

          <div>
            <label htmlFor={fid("role")} className="zh-label">Role</label>
            <select id={fid("role")} value={newRole} onChange={(e) => { setNewRole(e.target.value); setNewVendorId(""); }}
              className="zh-input">
              {Object.entries(roleLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>

          {newRole === "vendor_user" && (
            <div>
              <label htmlFor={fid("vendor")} className="zh-label">Linked vendor company</label>
              <select id={fid("vendor")} value={newVendorId} onChange={(e) => setNewVendorId(e.target.value)}
                aria-describedby={fid("vendor-hint")}
                className="zh-input">
                <option value="">— Select vendor —</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
              </select>
              <p id={fid("vendor-hint")} className="mt-1 text-xs text-muted">This vendor's assigned jobs will be visible to the user.</p>
            </div>
          )}

          <div>
            <label htmlFor={fid("password")} className="zh-label">Temporary password</label>
            <PasswordInput id={fid("password")} value={newPassword} onChange={setNewPassword}
              placeholder="Set a temporary password"
              invalid={!!fieldErrors.password}
              describedBy={fieldErrors.password ? fid("password-err") : undefined} />
            <FieldError id={fid("password-err")} message={fieldErrors.password} />
          </div>
        </form>
      </Modal>

      {/* Reset password (replaces window.prompt) */}
      <Modal
        open={!!resetUser}
        onClose={() => setResetUser(null)}
        preventClose={resetting}
        size="sm"
        title="Reset password"
        description={resetUser ? `Set a temporary password for ${resetUser.full_name || resetUser.email}. They must change it on next login.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetUser(null)} disabled={resetting}>Cancel</Button>
            <Button type="submit" form={fid("reset-form")} loading={resetting}>Reset password</Button>
          </>
        }
      >
        <form id={fid("reset-form")} onSubmit={handleResetPassword} noValidate>
          <label htmlFor={fid("reset-pwd")} className="zh-label">New temporary password</label>
          <PasswordInput id={fid("reset-pwd")} value={resetPwd}
            onChange={(v) => { setResetPwd(v); if (resetError) setResetError(""); }}
            invalid={!!resetError}
            describedBy={resetError ? fid("reset-err") : undefined}
            autoFocus />
          <FieldError id={fid("reset-err")} message={resetError} />
        </form>
      </Modal>
    </>
  );
}
