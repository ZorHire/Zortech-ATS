import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/layout/Layout";
import LoginPage from "./pages/LoginPage";
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

// vendor_user may access /jobs, /jobs/:id, and /pipeline/:jobId
const VENDOR_ALLOWED_PREFIXES = ["/jobs", "/pipeline"];

// These paths are accessible even when subscription is blocked/expired
const SUBSCRIPTION_EXEMPT_PATHS = ["/pricing", "/subscription", "/onboarding"];

function ProtectedRoute({ children, path, noLayout }: { children: React.ReactNode; path?: string; noLayout?: boolean }) {
  const { user, loading, subscription } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading platform...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (user.must_change_password) {
    return <ChangePasswordPage />;
  }

  if (user.role === "vendor_user" && path) {
    const allowed = VENDOR_ALLOWED_PREFIXES.some((p: string) => path === p || path.startsWith(p + "/"));
    if (!allowed) return <Navigate to="/jobs" replace />;
  }

  // Subscription gate: block onboarding companies with no active/trial subscription.
  // Platform owner (ZorTech) passes through. Fail open when subscription is null.
  const isSubscriptionExempt = path
    ? SUBSCRIPTION_EXEMPT_PATHS.some((p) => path === p || path.startsWith(p + "/"))
    : false;

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

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public entry points */}
      <Route
        path="/subscribe"
        element={user ? <Navigate to="/" replace /> : <SubscribePage />}
      />
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/screening/:sessionId" element={<ScreeningChatPage />} />
      {/* Pricing: public (no auth) shows standalone page; authenticated shows within Layout */}
      <Route
        path="/pricing"
        element={
          user
            ? <ProtectedRoute path="/pricing"><PricingPage /></ProtectedRoute>
            : <PublicPricingPage />
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute path="/">
            <DashboardPage />
          </ProtectedRoute>
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
        path="/vendors"
        element={
          <ProtectedRoute path="/vendors">
            <VendorsPage />
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
        path="/campaigns"
        element={
          <ProtectedRoute path="/campaigns">
            <EmailCampaignsPage />
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
        path="/assigned-jds"
        element={
          <ProtectedRoute path="/assigned-jds">
            <AssignedJDsPage />
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
      <Route path="*" element={<Navigate to={user ? "/" : "/subscribe"} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
