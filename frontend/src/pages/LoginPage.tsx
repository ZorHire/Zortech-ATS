import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Shield,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

import { Button, Spinner } from "../components/ui";

import {
  useLoginMutation,
  useForgotPasswordMutation,
} from "../store/api/authApi";

import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import { describeApiError } from "../store/api/baseApi";

import { setCredentials, setSessionStatus, selectSessionStatus } from "../store/slices/authSlice";

import type { AuthUser } from "../store/slices/authSlice";

import { setSubscription } from "../store/slices/subscriptionSlice";

type View = "login" | "reset";

type OAuthProvider = "google" | "microsoft";

export default function LoginPage() {
  const [view, setView] = useState<View>("login");

  const dispatch = useAppDispatch();

  // ---------------------------------------------------------------------------
  // Login state
  // ---------------------------------------------------------------------------

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const sessionStatus = useAppSelector(selectSessionStatus);

  // Google/Microsoft sign-in failures come back as /login?oauth_error=...
  const [error, setError] = useState(() => {
    const oauthError = searchParams.get("oauth_error");
    return oauthError ? `Single sign-on didn't work: ${oauthError}` : "";
  });
  const [loading, setLoading] = useState(false);

  const [login] = useLoginMutation();

  // ---------------------------------------------------------------------------
  // OAuth state
  // ---------------------------------------------------------------------------

  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const busy = loading || oauthLoading !== null;

  // ---------------------------------------------------------------------------
  // Reset password state
  // ---------------------------------------------------------------------------

  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [forgotPassword] = useForgotPasswordMutation();

  // ---------------------------------------------------------------------------
  // Email / Password Login
  // ---------------------------------------------------------------------------

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setLoading(true);
    if (searchParams.has("oauth_error")) setSearchParams({}, { replace: true });

    try {
      const data = await login({
        email,
        password,
      }).unwrap();

      // Store JWT exactly as before.
      localStorage.setItem("jwt", data.token);

      // Store authenticated user.
      dispatch(
        setCredentials({
          user: data.user as AuthUser,
          accessToken: data.token,
        }),
      );

      // Preserve existing subscription handling.
      dispatch(
        setSubscription(
          data.subscription
            ? {
                active: data.subscription.active,
                isPlatformOwner: data.subscription.isPlatformOwner ?? false,
                reason: data.subscription.reason ?? null,
              }
            : null,
        ),
      );

      // Preserve existing session state.
      dispatch(setSessionStatus("active"));
    } catch (err: any) {
      // Network/server failures must not read as "wrong password".
      setError(
        err?.status === 401 || err?.status === 400
          ? describeApiError(err, "Incorrect email or password.")
          : describeApiError(err, "Sign-in failed. Please try again."),
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // OAuth Login
  // ---------------------------------------------------------------------------
  //
  // The actual OAuth authentication happens on the backend.
  //
  // Google:
  //   GET /v1/auth/oauth/google
  //
  // Microsoft:
  //   GET /v1/auth/oauth/microsoft
  //
  // The backend will:
  //   1. Generate OAuth state
  //   2. Redirect to the provider
  //   3. Handle the provider callback
  //   4. Validate the OAuth identity
  //   5. Find the existing ZorHire user
  //   6. Check tenant/subscription
  //   7. Generate a short-lived exchange code
  //   8. Redirect to /oauth/callback
  //
  // The OAuth callback page will then exchange that code for the normal
  // ZorHire JWT.
  //
  // IMPORTANT:
  // We intentionally do NOT put the JWT directly into the URL.
  // ---------------------------------------------------------------------------

  const handleOAuthLogin = (provider: OAuthProvider) => {
    if (loading || oauthLoading) {
      return;
    }

    setError("");

    setOauthLoading(provider);

    // VITE_API_URL already ends in /v1 (e.g. https://zorhire.zortechs.in/v1).
    const apiBaseUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000/v1").replace(/\/$/, "");

    const oauthUrl = `${apiBaseUrl}/auth/oauth/${provider}`;

    // Redirect the browser to the backend OAuth endpoint.
    window.location.assign(oauthUrl);
  };

  // ---------------------------------------------------------------------------
  // Forgot Password
  // ---------------------------------------------------------------------------

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    setResetError("");
    setResetLoading(true);

    try {
      await forgotPassword({
        email: resetEmail,
      }).unwrap();

      setResetSuccess(true);
    } catch (err: any) {
      setResetError(describeApiError(err, "Failed to send reset link. Please try again."));
    } finally {
      setResetLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Back to Login
  // ---------------------------------------------------------------------------

  const goToLogin = () => {
    setView("login");

    setResetEmail("");
    setResetError("");
    setResetSuccess(false);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const benefits = [
    { icon: Workflow, text: "Every open role, pipeline stage and interview in one workspace" },
    { icon: Users, text: "Vendor submissions and client sharing without spreadsheets" },
    { icon: Sparkles, text: "AI-assisted resume parsing and candidate matching" },
    { icon: Lock, text: "Invite-only access with role-based permissions" },
  ];

  const ssoButton =
    "flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-white py-3 text-sm font-semibold text-ink shadow-sm transition-colors hover:border-line-strong hover:bg-surface disabled:cursor-not-allowed disabled:opacity-55";

  return (
    <div className="flex min-h-screen bg-surface">
      {/* ------------------------------------------------------------------ */}
      {/* Left panel                                                         */}
      {/* ------------------------------------------------------------------ */}

      <div className="hidden flex-col justify-center bg-navy-800 px-16 py-12 lg:flex lg:flex-1">
        <div className="max-w-lg">
          <div className="mb-12">
            <img src="/brand/zortech-logo-white.png" alt="ZorTech" className="h-8 w-auto" />
            <p className="mt-2 text-sm font-medium text-navy-200">ZorHire · Enterprise ATS Platform</p>
          </div>

          <h2 className="mb-5 text-4xl font-semibold leading-tight text-white">
            Full-cycle recruitment,
            <br />
            <span className="text-brand-400">intelligently automated.</span>
          </h2>

          <p className="mb-10 text-lg leading-relaxed text-navy-100">
            ZorHire provides a secure, invite-only environment for staffing
            agencies to manage their entire recruitment pipeline with AI-powered
            sourcing and real-time analytics.
          </p>

          <ul className="space-y-4">
            {benefits.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-navy-50">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-400">
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span className="pt-1.5">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Right panel                                                        */}
      {/* ------------------------------------------------------------------ */}

      <div className="flex flex-1 items-center justify-center bg-white px-4 py-12 sm:px-6 lg:max-w-md">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/brand/zortech-logo.png" alt="ZorTech" className="h-6 w-auto" />
            <span className="border-l border-line pl-3 text-sm font-semibold text-navy-700">ZorHire</span>
          </div>

          {/* ================================================================= */}
          {/* LOGIN VIEW                                                        */}
          {/* ================================================================= */}

          {view === "login" ? (
            <>
              <h1 className="mb-1 text-2xl font-semibold text-navy-800">Sign in to ZorHire</h1>

              <p className="mb-8 text-sm text-muted">
                Please enter your credentials to access the platform.
              </p>

              {sessionStatus === "expired" && !error && (
                <div role="status" className="mb-6 rounded-lg border border-brand-300 bg-warning-50 p-3 text-sm text-warning-700">
                  Your session expired. Please sign in again to continue where you left off.
                </div>
              )}

              {/* ------------------------------------------------------------ */}
              {/* OAuth Buttons                                                 */}
              {/* ------------------------------------------------------------ */}

              <div className="mb-6 space-y-3">
                {/* Google */}
                <button
                  type="button"
                  onClick={() => handleOAuthLogin("google")}
                  disabled={loading || oauthLoading !== null}
                  className={ssoButton}
                >
                  {oauthLoading === "google" ? (
                    <Spinner size={18} />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
                    </svg>
                  )}

                  <span>
                    {oauthLoading === "google"
                      ? "Connecting to Google..."
                      : "Continue with Google"}
                  </span>
                </button>

                {/* Microsoft */}
                <button
                  type="button"
                  onClick={() => handleOAuthLogin("microsoft")}
                  disabled={loading || oauthLoading !== null}
                  className={ssoButton}
                >
                  {oauthLoading === "microsoft" ? (
                    <Spinner size={18} />
                  ) : (
                    // Microsoft logo colours are fixed by their brand guidelines.
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                      <rect x="0" y="0" width="8" height="8" fill="#F25022" />
                      <rect x="10" y="0" width="8" height="8" fill="#7FBA00" />
                      <rect x="0" y="10" width="8" height="8" fill="#00A4EF" />
                      <rect x="10" y="10" width="8" height="8" fill="#FFB900" />
                    </svg>
                  )}

                  <span>
                    {oauthLoading === "microsoft"
                      ? "Connecting to Microsoft..."
                      : "Continue with Microsoft"}
                  </span>
                </button>
              </div>

              {/* Divider */}
              <div className="mb-6 flex items-center gap-3" aria-hidden="true">
                <div className="h-px flex-1 bg-line" />
                <span className="text-xs font-medium text-muted">or</span>
                <div className="h-px flex-1 bg-line" />
              </div>

              {/* ------------------------------------------------------------ */}
              {/* Email / Password Login                                        */}
              {/* ------------------------------------------------------------ */}

              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger-600/20 bg-danger-50 p-3 text-sm text-danger-700">
                    <Shield size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="login-email" className="zh-label">
                    Email address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    readOnly={busy}
                    className="zh-input"
                    placeholder="name@company.com"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="login-password" className="text-sm font-medium text-ink">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setView("reset")}
                      disabled={loading || oauthLoading !== null}
                      className="text-sm font-semibold text-navy-600 transition-colors hover:text-navy-800 disabled:opacity-50"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      readOnly={busy}
                      className="zh-input pr-12"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-ink"
                    >
                      {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  loading={loading}
                  loadingText="Signing in…"
                  disabled={oauthLoading !== null}
                  iconRight={<ArrowRight size={18} aria-hidden="true" />}
                >
                  Sign in
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted">
                New to ZorHire?{" "}
                <Link to="/book-demo" className="font-semibold text-navy-600 hover:text-navy-800 hover:underline">
                  Book a demo
                </Link>
              </p>

              <div className="mt-8 border-t border-line pt-8 text-center">
                <p className="text-xs leading-relaxed text-muted">
                  Protected by enterprise-grade security.
                  <br />
                  Access is restricted to authorized personnel only.
                </p>
              </div>
            </>
          ) : (
            /* =============================================================== */
            /* RESET PASSWORD VIEW                                             */
            /* =============================================================== */
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
                  <KeyRound size={20} aria-hidden="true" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-navy-800">Forgot password?</h1>
                  <p className="text-sm text-muted">Enter your email and we'll send a reset link.</p>
                </div>
              </div>

              {resetSuccess ? (
                <div className="flex flex-col items-center gap-4 py-8 text-center" role="status">
                  <CheckCircle2 size={48} aria-hidden="true" className="text-success-600" />
                  <p className="text-base font-semibold text-ink">Check your email</p>
                  <p className="text-sm text-muted">
                    If <strong className="text-ink">{resetEmail}</strong> is registered, a reset link
                    has been sent. It expires in 15 minutes.
                  </p>
                  <Button
                    size="lg"
                    fullWidth
                    className="mt-2"
                    onClick={goToLogin}
                    iconRight={<ArrowRight size={18} aria-hidden="true" />}
                  >
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                  {resetError && (
                    <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger-600/20 bg-danger-50 p-3 text-sm text-danger-700">
                      <Shield size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                      <span>{resetError}</span>
                    </div>
                  )}

                  <div>
                    <label htmlFor="reset-email" className="zh-label">
                      Email address
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      readOnly={resetLoading}
                      className="zh-input"
                      placeholder="name@company.com"
                    />
                  </div>

                  <Button type="submit" size="lg" fullWidth loading={resetLoading} loadingText="Sending…">
                    Send Reset Link
                  </Button>

                  <Button variant="ghost" fullWidth onClick={goToLogin} icon={<ArrowLeft size={16} aria-hidden="true" />}>
                    Back to Sign In
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
