import React from "react";
import {
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Save,
  Loader2,
  Calendar,
  Network,
} from "lucide-react";
import Header from "../components/layout/Header";
import { useGetProfileQuery, useUpdateProfileMutation } from "../store/api/profileApi";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import { setCredentials, selectCurrentUser, selectAccessToken } from "../store/slices/authSlice";
import { useNotify } from "../hooks/useNotify";

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector(selectCurrentUser);
  const accessToken = useAppSelector(selectAccessToken);
  const notify = useNotify();

  const { data: profile, isLoading } = useGetProfileQuery();
  const [updateProfile, { isLoading: isSaving }] = useUpdateProfileMutation();

  const [form, setForm] = React.useState({
    full_name: "",
    phone: "",
    department: "",
  });
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

  const handleSave = async () => {
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
    } catch {
      notify.error("Failed to update profile");
    }
  };

  const avatarLetter = (profile?.full_name || profile?.email || "U").charAt(0).toUpperCase();

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="My Profile" subtitle="View and edit your account information" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {isLoading ? (
            <div className="flex justify-center py-24">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Avatar + identity card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white shadow-md flex-shrink-0">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center">
                        <span className="text-3xl font-bold text-white">{avatarLetter}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {profile?.full_name || "—"}
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">{profile?.email}</p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 capitalize">
                        {profile?.role?.replace(/_/g, " ")}
                      </span>
                      {profile?.tenant_name && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Network size={11} />
                          {profile.tenant_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable fields */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <h3 className="font-semibold text-gray-900">Edit Information</h3>

                {/* Full name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      value={form.full_name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, full_name: e.target.value }))
                      }
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
                      placeholder="Your full name"
                    />
                  </div>
                </div>

                {/* Email — read-only */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Email
                  </label>
                  <div className="relative">
                    <Mail
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      value={profile?.email || ""}
                      readOnly
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Email address cannot be changed</p>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Phone
                  </label>
                  <div className="relative">
                    <Phone
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      value={form.phone}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
                      placeholder="+91 XXXXX XXXXX"
                    />
                  </div>
                </div>

                {/* Department */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Department
                  </label>
                  <div className="relative">
                    <Building2
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      value={form.department}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, department: e.target.value }))
                      }
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
                      placeholder="e.g. Engineering, HR"
                    />
                  </div>
                </div>

                {/* Role — read-only */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Role
                  </label>
                  <div className="relative">
                    <Briefcase
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      value={(profile?.role || "").replace(/_/g, " ")}
                      readOnly
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-500 cursor-not-allowed capitalize"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    Save Changes
                  </button>
                </div>
              </div>

              {/* Account details */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Account Details</h3>
                <dl className="space-y-3">
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-1.5 text-xs text-gray-400 uppercase tracking-wide">
                      <Calendar size={12} />
                      Member Since
                    </dt>
                    <dd className="text-sm font-medium text-gray-700">
                      {profile?.created_at
                        ? new Date(profile.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-1.5 text-xs text-gray-400 uppercase tracking-wide">
                      <Network size={12} />
                      Organization
                    </dt>
                    <dd className="text-sm font-medium text-gray-700">
                      {profile?.tenant_name || "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
