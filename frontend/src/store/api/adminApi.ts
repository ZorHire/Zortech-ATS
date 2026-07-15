import { baseApi } from "./baseApi";

export interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
}

export interface InviteUserPayload {
  email: string;
  full_name: string;
  role: string;
  password?: string;
  vendor_id?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  industry?: string;
  is_platform_owner: boolean;
  company_email: string | null;
  company_phone: string | null;
  country: string | null;
  is_active: boolean;
  onboarded_at: string | null;
  onboarded_by?: string | null;
  created_at: string;
  subscription_status: string | null;
  plan_type: string | null;
  subscription_end_date: string | null;
  user_count?: number;
  user_limit?: number;
  active_jobs?: number;
}

export interface OnboardTenantPayload {
  company_name: string;
  admin_full_name: string;
  admin_email: string;
  admin_password: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  gst_number?: string;
  country?: string;
}

export interface OnboardingStatus {
  tenant_id: string;
  account_created: boolean;
  profile_complete: boolean;
  team_invited: boolean;
  pipeline_created: boolean;
  channel_connected: boolean;
  first_job_posted: boolean;
  completed_steps: number;
  total_steps: number;
  percent_complete: number;
}

export const adminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<ManagedUser[], void>({
      query: () => "/admin/users",
      providesTags: ["Users"],
    }),

    inviteUser: builder.mutation<ManagedUser, InviteUserPayload>({
      query: (body) => ({ url: "/admin/users", method: "POST", body }),
      invalidatesTags: ["Users"],
    }),

    deleteUser: builder.mutation<void, string>({
      query: (id) => ({ url: `/admin/users/${id}`, method: "DELETE" }),
      invalidatesTags: ["Users"],
    }),

    toggleUserStatus: builder.mutation<void, { id: string; is_active: boolean }>({
      query: ({ id, is_active }) => ({
        url: `/admin/users/${id}`,
        method: "PATCH",
        body: { is_active },
      }),
      invalidatesTags: ["Users"],
    }),

    resetUserPassword: builder.mutation<void, { userId: string; newPassword: string }>({
      query: ({ userId, newPassword }) => ({
        url: `/admin/users/${userId}/reset-password`,
        method: "POST",
        body: { newPassword },
      }),
    }),

    getTenants: builder.query<Tenant[], void>({
      query: () => "/tenants",
      providesTags: ["Tenants"],
    }),

    bulkDeleteTenants: builder.mutation<void, string[]>({
      query: (ids) => ({ url: "/tenants/bulk-delete", method: "POST", body: { ids } }),
      invalidatesTags: ["Tenants"],
    }),

    toggleTenantStatus: builder.mutation<void, { id: string; is_active: boolean }>({
      query: ({ id, is_active }) => ({
        url: `/tenants/${id}/status`,
        method: "PATCH",
        body: { is_active },
      }),
      invalidatesTags: ["Tenants"],
    }),

    onboardTenant: builder.mutation<Tenant, OnboardTenantPayload>({
      query: (body) => ({ url: "/tenants/onboard", method: "POST", body }),
      invalidatesTags: ["Tenants"],
    }),

    getOnboardingStatus: builder.query<OnboardingStatus, void>({
      query: () => "/onboarding/status",
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetUsersQuery,
  useInviteUserMutation,
  useDeleteUserMutation,
  useToggleUserStatusMutation,
  useResetUserPasswordMutation,
  useGetTenantsQuery,
  useBulkDeleteTenantsMutation,
  useToggleTenantStatusMutation,
  useOnboardTenantMutation,
  useGetOnboardingStatusQuery,
} = adminApi;
