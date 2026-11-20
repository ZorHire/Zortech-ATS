import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { clearCredentials, setSessionStatus } from "../slices/authSlice";
import { markServerReachable, markServerUnreachable } from "../slices/connectionSlice";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || "http://localhost:5000/v1",
  // Without a timeout a hung server leaves spinners running forever. Generous,
  // because resume/JD uploads with AI parsing can legitimately take a while.
  timeout: 90000,
  prepareHeaders: (headers, { getState }) => {
    // Read token from Redux store first; fall back to localStorage for
    // the migration window while legacy api.ts callers still write "jwt".
    const state = getState() as { auth: { accessToken: string | null } };
    const token = state.auth.accessToken ?? localStorage.getItem("jwt");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

/** True when the request never got a usable answer from the API (down, timed out, gateway error). */
export function isServerUnreachableError(error: unknown): boolean {
  const status = (error as FetchBaseQueryError | undefined)?.status;
  return (
    status === "FETCH_ERROR" ||
    status === "TIMEOUT_ERROR" ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

/** Turns an RTK Query / unwrap() error into a sentence a recruiter can act on. */
export function describeApiError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const e = error as (FetchBaseQueryError & { data?: { message?: string; error?: string } }) | undefined;
  if (!e) return fallback;
  if (isServerUnreachableError(e)) {
    return "Can't reach the ZorHire server right now. Please try again in a few minutes.";
  }
  if (e.status === "PARSING_ERROR" || (typeof e.status === "number" && e.status >= 500)) {
    return "Something went wrong on our side. Please try again shortly.";
  }
  if (e.status === 429) return "Too many attempts. Please wait a minute and try again.";
  const msg = e.data?.message || e.data?.error;
  return typeof msg === "string" && msg.trim() ? msg : fallback;
}

// Auto-logout on 401, and track whether the API is reachable at all.
const baseQueryWith401: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  const state = api.getState() as { auth: { accessToken: string | null; user: unknown } };
  const hadSession = !!(state.auth.user || state.auth.accessToken || localStorage.getItem("jwt"));

  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error && isServerUnreachableError(result.error)) {
    api.dispatch(markServerUnreachable());
  } else {
    api.dispatch(markServerReachable());
  }

  // A 401 on the login request itself is just "wrong password", not an expired session.
  if (result.error?.status === 401 && hadSession) {
    api.dispatch(clearCredentials());
    api.dispatch(setSessionStatus("expired"));
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
    "Autopilot",
    "AgentActivity",
    "AgentInsights",
  ],
  endpoints: () => ({}),
});
