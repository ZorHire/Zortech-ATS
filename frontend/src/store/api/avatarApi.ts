import { baseApi } from "./baseApi";

export const avatarApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    uploadAvatar: builder.mutation<{ avatar_url: string }, FormData>({
      query: (formData) => ({
        url: "/profile/avatar",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["Profile", "Auth"],
    }),
  }),
  overrideExisting: false,
});

export const { useUploadAvatarMutation } = avatarApi;
