import { baseApi } from "./baseApi";

export const avatarApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    uploadAvatar: builder.mutation<{ avatar_url: string }, FormData>({
      query: (formData) => ({
        url: "/profiles/avatar",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["Profile"],
    }),
  }),
  overrideExisting: false,
});

export const { useUploadAvatarMutation } = avatarApi;
