import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAppDispatch } from "./hooks/useAppDispatch";
import { useAppSelector } from "./hooks/useAppSelector";
import {
  selectCurrentUser,
  selectSessionStatus,
  setCredentials,
  clearCredentials,
  setSessionStatus,
} from "./store/slices/authSlice";
import type { AuthUser } from "./store/slices/authSlice";
import {
  selectSubscription,
  setSubscription,
} from "./store/slices/subscriptionSlice";
import type { SubscriptionInfo } from "./store/slices/subscriptionSlice";
import { useMeQuery } from "./store/api/authApi";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/layout/Layout";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import OAuthCallbackPage from "./pages/OAuthCallbackPage";
import { FullPageLoader, ServerUnreachableScreen } from "./components/layout/AppStatusScreens";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SubscribePage from "./pages/SubscribePage";
import PublicPricingPage from "./pages/PublicPricingPage";
import DashboardPage from "./pages/DashboardPage";
import JobsPage from "./pages/JobsPage";
import JobDetailPage from "./pages/JobDetailPage";
import NewJobPage from "./pages/NewJobPage";
import CandidatesPage from "./pages/CandidatesPage";
import VendorsPage from "./pages/VendorsPage";
import ResumeSearchPage from "./pages/ResumeSearchPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AdminPage from "./pages/AdminPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import PipelinePage from "./pages/PipelinePage";
import EmailSettingsPage from "./pages/EmailSettingsPage";
import EmailCampaignsPage from "./pages/EmailCampaignsPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import PricingPage from "./pages/PricingPage";
import OnboardingPage from "./pages/OnboardingPage";
import CompaniesPage from "./pages/CompaniesPage";
import AssignedJDsPage from "./pages/AssignedJDsPage";
import ScreeningChatPage from "./pages/ScreeningChatPage";
import InterviewsPage from "./pages/InterviewsPage";
import OffersPage from "./pages/OffersPage";
import ReportsPage from "./pages/ReportsPage";
import ProfilePage from "./pages/ProfilePage";
import CandidateDetailPage from "./pages/CandidateDetailPage";
import JobBoardsSettingsPage from "./pages/JobBoardsSettingsPage";
import EmailCampaignDetailPage from "./pages/EmailCampaignDetailPage";
import VendorLeaderboardPage from "./pages/VendorLeaderboardPage";
import ClientsPage from "./pages/ClientsPage";
import VendorPortalJobsPage from "./pages/vendor-portal/VendorPortalJobsPage";
import VendorPortalSubmissionsPage from "./pages/vendor-portal/VendorPortalSubmissionsPage";
import ClientPortalJobsPage from "./pages/client-portal/ClientPortalJobsPage";
import ClientCandidatesPage from "./pages/client-portal/ClientCandidatesPage";

// vendor_user may access /jobs, /jobs/:id, /pipeline/:jobId, and /vendor-portal/*
const VENDOR_ALLOWED_PREFIXES = ["/jobs", "/pipeline", "/vendor-portal"];

// client_user may only access /client-portal/*
const CLIENT_ALLOWED_PREFIXES = ["/client-portal"];

// These paths are accessible even when subscription is blocked/expired
const SUBSCRIPTION_EXEMPT_PATHS = ["/pricing", "/subscription", "/onboarding"];

// Portal paths bypass the subscription gate — portal users don't control the subscription
const PORTAL_PREFIXES = ["/vendor-portal", "/client-portal"];

// Replaces the old AuthSyncer+AuthProvider bridge.
// Calls /auth/me on load (if JWT exists) and populates Redux auth state.
// Also listens for mid-session 401 events from legacy api.ts calls.
function SessionRestorer() {
  const dispatch = useAppDispatch();
  const hasToken = !!localStorage.getItem("jwt");

  const { data, isSuccess, isError, error } = useMeQuery(undefined, {
    skip: !hasToken,
  });

  // No token → immediately resolve as unauthenticated
  useEffect(() => {
    if (!hasToken) dispatch(setSessionStatus("active"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Success: populate Redux with user + subscription from /auth/me
  useEffect(() => {
    if (!isSuccess || !data) return;
    const { subscription, ...user } = data;
    dispatch(
      setCredentials({
        user: user as AuthUser,
        accessToken: localStorage.getItem("jwt"),
      }),
    );
    dispatch(
      setSubscription(
        subscription
          ? ({
              active: subscription.active,
              isPlatformOwner: subscription.isPlatformOwner ?? false,
              reason: subscription.reason ?? null,
            } satisfies SubscriptionInfo)
          : null,
      ),
    );
    dispatch(setSessionStatus("active"));
  }, [isSuccess, data, dispatch]);

  // Only a real auth rejection ends the session. If the server is down or
  // erroring, keep the token and show a "can't reach ZorHire" screen instead
  // of logging everyone out (the base query already handles 401).
  useEffect(() => {
    if (!isError) return;
    const status = (error as { status?: unknown } | undefined)?.status;
    if (status === 401 || status === 403) {
      dispatch(clearCredentials());
      dispatch(setSessionStatus("expired"));
    } else {
      dispatch(setSessionStatus("unreachable"));
    }
  }, [isError, error, dispatch]);

  // Handle mid-session 401s fired by legacy api.ts calls
  useEffect(() => {
    const onUnauthorized = () => {
      dispatch(clearCredentials());
      dispatch(setSessionStatus("expired"));
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () =>
      window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, [dispatch]);

  return null;
}

function ProtectedRoute({
  children,
  path,
  noLayout,
}: {
  children: React.ReactNode;
  path?: string;
  noLayout?: boolean;
}) {
  const user = useAppSelector(selectCurrentUser);
  const sessionStatus = useAppSelector(selectSessionStatus);
  const subscription = useAppSelector(selectSubscription);
  const location = useLocation();

  // Show spinner while SessionRestorer hasn't resolved yet.
  if (sessionStatus === "idle") return <FullPageLoader />;

  // Signed in, but the API can't be reached: keep the session and offer a retry.
  if (sessionStatus === "unreachable" && !user) return <ServerUnreachableScreen />;

  // Remember where the user was heading so login can send them back there.
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  // Gate 1: force password change before any other navigation
  if (user.must_change_password) {
    return <ChangePasswordPage />;
  }

  // Gate 2a: vendor_user is restricted to jobs, pipeline, and vendor portal
  if (user.role === "vendor_user" && path) {
    const allowed = VENDOR_ALLOWED_PREFIXES.some(
      (p: string) => path === p || path.startsWith(p + "/"),
    );
    if (!allowed) return <Navigate to="/vendor-portal/jobs" replace />;
  }

  // Gate 2b: client_user is restricted to client portal only
  if (user.role === "client_user" && path) {
    const allowed = CLIENT_ALLOWED_PREFIXES.some(
      (p: string) => path === p || path.startsWith(p + "/"),
    );
    if (!allowed) return <Navigate to="/client-portal/jobs" replace />;
  }

  // Gate 3: subscription gate — blocks onboarding companies with no active/trial plan.
  // Platform owner (ZorTech) always passes. null means still loading → fail open.
  // Portal paths are also exempt — portal users don't manage subscription.
  const isPortalPath = path
    ? PORTAL_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))
    : false;

  const isSubscriptionExempt =
    isPortalPath ||
    (path
      ? SUBSCRIPTION_EXEMPT_PATHS.some(
          (p) => path === p || path.startsWith(p + "/"),
        )
      : false);

  if (
    !isSubscriptionExempt &&
    subscription !== null &&
    !subscription.active &&
    !subscription.isPlatformOwner
  ) {
    return <Navigate to="/pricing" replace />;
  }

  if (noLayout) return <>{children}</>;
  return <Layout>{children}</Layout>;
}

/** Login page; once signed in, go back to the page the user originally wanted. */
function LoginRoute() {
  const user = useAppSelector(selectCurrentUser);
  const location = useLocation();
  if (user) {
    const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
    const target = from?.pathname && from.pathname !== "/login" ? `${from.pathname}${from.search ?? ""}` : "/";
    return <Navigate to={target} replace />;
  }
  return <LoginPage />;
}

function AppRoutes() {
  const user = useAppSelector(selectCurrentUser);
  const sessionStatus = useAppSelector(selectSessionStatus);
  // A stored token means "probably signed in": don't flash the marketing page
  // while the session is being restored (or while the API is down).
  const restoringSession =
    !user && !!localStorage.getItem("jwt") && (sessionStatus === "idle" || sessionStatus === "unreachable");

  return (
    <Routes>
      {/* Public entry points */}
      <Route
        path="/subscribe"
        element={user ? <Navigate to="/" replace /> : <SubscribePage />}
      />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/screening/:sessionId" element={<ScreeningChatPage />} />
      {/* Pricing: public (no auth) shows standalone page; authenticated shows within Layout */}
      <Route
        path="/pricing"
        element={
          user ? (
            <ProtectedRoute path="/pricing">
              <PricingPage />
            </ProtectedRoute>
          ) : (
            <PublicPricingPage />
          )
        }
      />
      <Route
        path="/"
        element={
          user || restoringSession ? (
            <ProtectedRoute path="/">
              <DashboardPage />
            </ProtectedRoute>
          ) : (
            <LandingPage />
          )
        }
      />
      <Route
        path="/jobs"
        element={
          <ProtectedRoute path="/jobs">
            <JobsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs/new"
        element={
          <ProtectedRoute path="/jobs/new">
            <NewJobPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs/:id"
        element={
          <ProtectedRoute path="/jobs/:id">
            <JobDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pipeline/:jobId"
        element={
          <ProtectedRoute path="/pipeline/:jobId">
            <PipelinePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/candidates"
        element={
          <ProtectedRoute path="/candidates">
            <CandidatesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/candidates/:id"
        element={
          <ProtectedRoute path="/candidates/:id">
            <CandidateDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendors"
        element={
          <ProtectedRoute path="/vendors">
            <VendorsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendors/leaderboard"
        element={
          <ProtectedRoute path="/vendors/leaderboard">
            <VendorLeaderboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/search"
        element={
          <ProtectedRoute path="/search">
            <ResumeSearchPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute path="/analytics">
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute path="/admin">
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/email"
        element={
          <ProtectedRoute path="/settings/email">
            <EmailSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/job-boards"
        element={
          <ProtectedRoute path="/settings/job-boards">
            <JobBoardsSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns"
        element={
          <ProtectedRoute path="/campaigns">
            <EmailCampaignsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/:id"
        element={
          <ProtectedRoute path="/campaigns/:id">
            <EmailCampaignDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/subscription"
        element={
          <ProtectedRoute path="/subscription">
            <SubscriptionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/companies"
        element={
          <ProtectedRoute path="/companies">
            <CompaniesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients"
        element={
          <ProtectedRoute path="/clients">
            <ClientsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/assigned-jds"
        element={
          <ProtectedRoute path="/assigned-jds">
            <AssignedJDsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interviews"
        element={
          <ProtectedRoute path="/interviews">
            <InterviewsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/offers"
        element={
          <ProtectedRoute path="/offers">
            <OffersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute path="/reports">
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute path="/profile">
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute path="/onboarding" noLayout>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      {/* Vendor Self-Service Portal */}
      <Route
        path="/vendor-portal/jobs"
        element={
          <ProtectedRoute path="/vendor-portal/jobs" noLayout>
            <VendorPortalJobsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendor-portal/submissions"
        element={
          <ProtectedRoute path="/vendor-portal/submissions" noLayout>
            <VendorPortalSubmissionsPage />
          </ProtectedRoute>
        }
      />

      {/* Client Portal */}
      <Route
        path="/client-portal/jobs"
        element={
          <ProtectedRoute path="/client-portal/jobs" noLayout>
            <ClientPortalJobsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/client-portal/jobs/:jobId/candidates"
        element={
          <ProtectedRoute path="/client-portal/jobs/:jobId/candidates" noLayout>
            <ClientCandidatesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <SessionRestorer />
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
