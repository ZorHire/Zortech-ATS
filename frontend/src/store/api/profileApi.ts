import { baseApi } from "./baseApi";

export interface ProfileData {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  phone?: string;
  department?: string;
  role: string;
  tenant_name: string;
  created_at: string;
}

export interface UpdateProfileBody {
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  department?: string | null;
}

export const profileApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProfile: builder.query<ProfileData, void>({
      query: () => "/profile",
      providesTags: ["Profile"],
    }),
    updateProfile: builder.mutation<ProfileData, UpdateProfileBody>({
      query: (body) => ({
        url: "/profile",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Profile"],
    }),
  }),
  overrideExisting: false,
});

export const { useGetProfileQuery, useUpdateProfileMutation } = profileApi;
