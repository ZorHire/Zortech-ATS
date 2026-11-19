import React from "react";
import {
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Save,
  Calendar,
  Network,
} from "lucide-react";
import { useGetProfileQuery, useUpdateProfileMutation } from "../store/api/profileApi";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import { setCredentials, selectCurrentUser, selectAccessToken } from "../store/slices/authSlice";
import { useNotify } from "../hooks/useNotify";
import { useAvatarSrc } from "../hooks/useAvatarSrc";
import { useUploadAvatarMutation } from "../store/api/avatarApi";
import { describeApiError } from "../store/api/baseApi";
import { Badge, Button, ErrorState, PageHeader, Skeleton } from "../components/ui";

const iconCls = "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted";

function ProfileSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading profile">
      <div className="zh-card flex items-center gap-5 p-6">
        <Skeleton className="h-20 w-20 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-56" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="zh-card space-y-5 p-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector(selectCurrentUser);
  const accessToken = useAppSelector(selectAccessToken);
  const notify = useNotify();
  const [uploadAvatar, { isLoading: uploadingAvatar }] = useUploadAvatarMutation();
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  const { data: profile, isLoading, isError, error, refetch, isFetching } = useGetProfileQuery();
  // Uploaded photos are only served through the authenticated API.
  const avatarSrc = useAvatarSrc("me", profile?.avatar_url);

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      notify.error("Please choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify.error("Image is too large. The limit is 5 MB.");
      return;
    }
    const form = new FormData();
    form.append("avatar", file);
    try {
      await uploadAvatar(form).unwrap();
      notify.success("Profile photo updated.");
    } catch (err) {
      notify.error(describeApiError(err, "Could not upload the photo. Please try again."));
    }
  };
  const [updateProfile, { isLoading: isSaving }] = useUpdateProfileMutation();

  const [form, setForm] = React.useState({
    full_name: "",
    phone: "",
    department: "",
  });
  const [nameError, setNameError] = React.useState("");
  const [initialized, setInitialized] = React.useState(false);

  React.useEffect(() => {
    if (profile && !initialized) {
      setForm({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        department: profile.department || "",
      });
      setInitialized(true);
    }
  }, [profile, initialized]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!form.full_name.trim()) {
      setNameError("Please enter your full name.");
      return;
    }
    setNameError("");
    try {
      const updated = await updateProfile({
        full_name: form.full_name,
        phone: form.phone || null,
        department: form.department || null,
      }).unwrap();

      if (currentUser) {
        dispatch(
          setCredentials({
            user: {
              ...currentUser,
              full_name: updated.full_name,
              avatar_url: updated.avatar_url,
            },
            accessToken,
          })
        );
      }

      notify.success("Profile updated successfully");
    } catch (err) {
      notify.error(describeApiError(err, "Failed to update profile"));
    }
  };

  const avatarLetter = (profile?.full_name || profile?.email || "U").charAt(0).toUpperCase();

  return (
    <>
      <PageHeader title="My Profile" subtitle="View and edit your account information" />

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-2xl space-y-5">
          {isLoading ? (
            <ProfileSkeleton />
          ) : isError || !profile ? (
            // Never show an empty, saveable form when the profile didn't load.
            <div className="zh-card">
              <ErrorState
                error={error}
                title="Couldn't load your profile"
                onRetry={refetch}
                retrying={isFetching}
              />
            </div>
          ) : (
            <>
              {/* Avatar + identity card */}
              <div className="zh-card p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
                  <div className="flex shrink-0 flex-col items-center gap-2">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-navy-600">
                        <span className="text-3xl font-semibold text-white">{avatarLetter}</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    aria-label="Choose a profile photo"
                    onChange={handleAvatarFile}
                  />
                  <Button
                    variant="link"
                    size="sm"
                    loading={uploadingAvatar}
                    loadingText="Uploading…"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    {profile.avatar_url ? "Change photo" : "Add photo"}
                  </Button>
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold text-ink">{profile.full_name || "—"}</h2>
                    <p className="mt-0.5 break-all text-sm text-muted">{profile.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {profile.role && (
                        <Badge tone="brand" className="capitalize">
                          {profile.role.replace(/_/g, " ")}
                        </Badge>
                      )}
                      {profile.tenant_name && (
                        <span className="flex items-center gap-1 text-xs text-muted">
                          <Network size={12} aria-hidden="true" />
                          {profile.tenant_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable fields */}
              <form onSubmit={handleSave} noValidate className="zh-card space-y-5 p-5 sm:p-6">
                <h3 className="text-base font-semibold text-ink">Edit Information</h3>

                <div>
                  <label htmlFor="profile-name" className="zh-label">
                    Full name
                  </label>
                  <div className="relative">
                    <User size={15} aria-hidden="true" className={iconCls} />
                    <input
                      id="profile-name"
                      autoComplete="name"
                      value={form.full_name}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, full_name: e.target.value }));
                        if (nameError) setNameError("");
                      }}
                      aria-invalid={nameError ? true : undefined}
                      aria-describedby={nameError ? "profile-name-error" : undefined}
                      className="zh-input pl-9"
                      placeholder="Your full name"
                    />
                  </div>
                  {nameError && (
                    <p id="profile-name-error" className="mt-1 text-xs text-danger-600">
                      {nameError}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="profile-email" className="zh-label">
                    Email
                  </label>
                  <div className="relative">
                    <Mail size={15} aria-hidden="true" className={iconCls} />
                    <input
                      id="profile-email"
                      value={profile.email || ""}
                      readOnly
                      aria-describedby="profile-email-hint"
                      className="zh-input cursor-not-allowed bg-surface-sunken pl-9 text-muted"
                    />
                  </div>
                  <p id="profile-email-hint" className="mt-1 text-xs text-muted">
                    Email address cannot be changed
                  </p>
                </div>

                <div>
                  <label htmlFor="profile-phone" className="zh-label">
                    Phone
                  </label>
                  <div className="relative">
                    <Phone size={15} aria-hidden="true" className={iconCls} />
                    <input
                      id="profile-phone"
                      type="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className="zh-input pl-9"
                      placeholder="+91 XXXXX XXXXX"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="profile-department" className="zh-label">
                    Department
                  </label>
                  <div className="relative">
                    <Building2 size={15} aria-hidden="true" className={iconCls} />
                    <input
                      id="profile-department"
                      autoComplete="organization-title"
                      value={form.department}
                      onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                      className="zh-input pl-9"
                      placeholder="e.g. Engineering, HR"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="profile-role" className="zh-label">
                    Role
                  </label>
                  <div className="relative">
                    <Briefcase size={15} aria-hidden="true" className={iconCls} />
                    <input
                      id="profile-role"
                      value={(profile.role || "").replace(/_/g, " ")}
                      readOnly
                      className="zh-input cursor-not-allowed bg-surface-sunken pl-9 capitalize text-muted"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button type="submit" loading={isSaving} loadingText="Saving…" icon={<Save size={14} aria-hidden="true" />}>
                    Save Changes
                  </Button>
                </div>
              </form>

              {/* Account details */}
              <div className="zh-card p-5 sm:p-6">
                <h3 className="mb-4 text-base font-semibold text-ink">Account Details</h3>
                <dl className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-1.5 text-sm text-muted">
                      <Calendar size={14} aria-hidden="true" />
                      Member since
                    </dt>
                    <dd className="text-right text-sm font-medium text-ink">
                      {profile.created_at
                        ? new Date(profile.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-1.5 text-sm text-muted">
                      <Network size={14} aria-hidden="true" />
                      Organization
                    </dt>
                    <dd className="text-right text-sm font-medium text-ink">{profile.tenant_name || "—"}</dd>
                  </div>
                </dl>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
