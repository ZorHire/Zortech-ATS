import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { clearCredentials } from "../slices/authSlice";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || "http://localhost:5000/v1",
  prepareHeaders: (headers, { getState }) => {
    // Read token from Redux store first; fall back to localStorage for
    // the migration window while legacy api.ts callers still write "jwt".
    const state = getState() as { auth: { accessToken: string | null } };
    const token = state.auth.accessToken ?? localStorage.getItem("jwt");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

// Auto-logout on any 401 from RTK Query endpoints.
const baseQueryWith401: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401) {
    api.dispatch(clearCredentials());
  }
  return result;
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWith401,
  tagTypes: [
    "Auth",
    "Candidates",
    "Candidate",
    "Jobs",
    "Job",
    "Pipeline",
    "Vendors",
    "Vendor",
    "EmailConfig",
    "EmailCampaigns",
    "Billing",
    "Dashboard",
    "Users",
    "Analytics",
    "Companies",
    "Clients",
    "Tenants",
    "VendorPortalJobs",
    "VendorSubmissions",
    "VendorProfile",
    "ClientPortalJobs",
    "ClientPortalCandidates",
    "ClientProfile",
    "ClientUsers",
    "JobApproval",
    "JobVersions",
    "PendingApprovals",
    "VendorScorecard",
    "VendorContracts",
    "VendorLeaderboard",
    "Interviews",
    "Offers",
    "Profile",
    "Notifications",
    "JobBoards",
    "JobBoardPostings",
    "EmailUnsubscribes",
    "Integrations",
    "SchedulingLinks",
    "Invoices",
    "Invoice",
    "SavedSearches",
    "VendorDocuments",
    "Client",
  ],
  endpoints: () => ({}),
});
