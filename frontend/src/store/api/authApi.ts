import { baseApi } from "./baseApi";
import type { ApiSubscription } from "../slices/subscriptionSlice";

export interface LoginPayload {
  email: string;
  password: string;
  role?: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    must_change_password?: boolean;
    vendor_id?: string;
    avatar_url?: string;
  };
  subscription: ApiSubscription | null;
}

// /auth/me returns flat: { id, email, ..., subscription }
export interface MeResponse {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  must_change_password?: boolean;
  vendor_id?: string;
  avatar_url?: string;
  subscription: ApiSubscription | null;
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginPayload>({
      query: (body) => ({ url: "/auth/login", method: "POST", body, timeout: 20000 }),
    }),

    me: builder.query<MeResponse, void>({
      // Short timeout: this gates the whole app on load, so fail fast to the "can't reach" screen.
      query: () => ({ url: "/auth/me", timeout: 10000 }),
      providesTags: ["Auth"],
    }),

    logout: builder.mutation<void, void>({
      query: () => ({ url: "/auth/logout", method: "POST", body: {} }),
      invalidatesTags: ["Auth"],
    }),

    changePassword: builder.mutation<
      void,
      { currentPassword: string; newPassword: string }
    >({
      query: (body) => ({ url: "/auth/change-password", method: "POST", body }),
    }),

    forgotPassword: builder.mutation<void, { email: string }>({
      query: (body) => ({ url: "/auth/forgot-password", method: "POST", body }),
    }),

    resetPassword: builder.mutation<void, { token: string; newPassword: string }>({
      query: (body) => ({ url: "/auth/reset-password", method: "POST", body }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useLoginMutation,
  useMeQuery,
  useLazyMeQuery,
  useLogoutMutation,
  useChangePasswordMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
} = authApi;
