import { useState } from "react";
import {
  Briefcase,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  KeyRound,
  CheckCircle2,
  Chrome,
} from "lucide-react";

import {
  useLoginMutation,
  useForgotPasswordMutation,
} from "../store/api/authApi";

import { useAppDispatch } from "../hooks/useAppDispatch";

import { setCredentials, setSessionStatus } from "../store/slices/authSlice";

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

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [login] = useLoginMutation();

  // ---------------------------------------------------------------------------
  // OAuth state
  // ---------------------------------------------------------------------------

  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

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
      setError(
        err?.data?.message ||
          err?.message ||
          "Login failed. Please check your credentials.",
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

    const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";

    const oauthUrl =
      provider === "google"
        ? `${apiBaseUrl}/v1/auth/oauth/google`
        : `${apiBaseUrl}/v1/auth/oauth/microsoft`;

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
      setResetError(
        err?.data?.message ||
          err?.message ||
          "Failed to send reset link. Please try again.",
      );
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#281a10] via-[#1a110a] to-[#0b0704] flex">
      {/* ------------------------------------------------------------------ */}
      {/* Left panel                                                         */}
      {/* ------------------------------------------------------------------ */}

      <div className="hidden lg:flex lg:flex-1 flex-col justify-center px-16 py-12">
        <div className="max-w-lg">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-[#b47b3b] rounded-xl flex items-center justify-center shadow-xl shadow-[#967043]/25">
              <Briefcase size={24} className="text-white" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-[#f6e6d2]">ZorHire</h1>

              <p className="text-[#d8b286] text-sm">Enterprise ATS Platform</p>
            </div>
          </div>

          {/* Hero */}
          <h2 className="text-4xl font-bold text-[#fff3e4] leading-tight mb-5">
            Full-cycle recruitment,
            <br />
            <span className="text-[#f0c491]">intelligently automated.</span>
          </h2>

          <p className="text-[#c8b29d] text-lg leading-relaxed mb-10">
            ZorHire provides a secure, invite-only environment for staffing
            agencies to manage their entire recruitment pipeline with AI-powered
            sourcing and real-time analytics.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                label: "Active Jobs",
                value: "12+",
                sub: "across clients",
              },
              {
                label: "Candidates",
                value: "5,000+",
                sub: "in database",
              },
              {
                label: "Security",
                value: "Invite-only",
                sub: "protected access",
              },
              {
                label: "AI Match Rate",
                value: "92%",
                sub: "accuracy",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-[#1b120b]/80 border border-[#f2dbc0]/15 rounded-xl p-4"
              >
                <p className="text-2xl font-bold text-[#f9e8d1]">
                  {stat.value}
                </p>

                <p className="text-xs text-[#c2a687] mt-1">
                  {stat.label} · {stat.sub}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Right panel                                                        */}
      {/* ------------------------------------------------------------------ */}

      <div className="flex-1 lg:max-w-md flex items-center justify-center px-6 py-12 bg-[#f7efe4]">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-[#b47b3b] rounded-lg flex items-center justify-center shadow-sm shadow-[#9b713e]/25">
              <Briefcase size={16} className="text-white" />
            </div>

            <span className="font-bold text-[#3a230f]">ZorHire</span>
          </div>

          {/* ================================================================= */}
          {/* LOGIN VIEW                                                        */}
          {/* ================================================================= */}

          {view === "login" ? (
            <>
              <h2 className="text-2xl font-bold text-[#3a230f] mb-1">
                Welcome back
              </h2>

              <p className="text-sm text-[#7d6651] mb-8">
                Please enter your credentials to access the platform.
              </p>

              {/* ------------------------------------------------------------ */}
              {/* OAuth Buttons                                                 */}
              {/* ------------------------------------------------------------ */}

              <div className="space-y-3 mb-6">
                {/* Google */}
                <button
                  type="button"
                  onClick={() => handleOAuthLogin("google")}
                  disabled={loading || oauthLoading !== null}
                  className="w-full bg-white border border-[#dfd0bf] text-[#3a230f] py-3.5 rounded-xl font-semibold text-sm hover:bg-[#fffaf5] hover:border-[#cbb49a] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
                >
                  {oauthLoading === "google" ? (
                    <div className="w-5 h-5 border-2 border-[#b67031]/30 border-t-[#b67031] rounded-full animate-spin" />
                  ) : (
                    <Chrome size={19} className="text-[#b67031]" />
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
                  className="w-full bg-white border border-[#dfd0bf] text-[#3a230f] py-3.5 rounded-xl font-semibold text-sm hover:bg-[#fffaf5] hover:border-[#cbb49a] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
                >
                  {oauthLoading === "microsoft" ? (
                    <div className="w-5 h-5 border-2 border-[#b67031]/30 border-t-[#b67031] rounded-full animate-spin" />
                  ) : (
                    <span className="grid grid-cols-2 gap-[2px] w-[18px] h-[18px]">
                      <span className="bg-[#f25022]" />
                      <span className="bg-[#7fba00]" />
                      <span className="bg-[#00a4ef]" />
                      <span className="bg-[#ffb900]" />
                    </span>
                  )}

                  <span>
                    {oauthLoading === "microsoft"
                      ? "Connecting to Microsoft..."
                      : "Continue with Microsoft"}
                  </span>
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1 bg-[#e6d7c0]" />

                <span className="text-[11px] font-semibold text-[#9b856f] uppercase tracking-wider">
                  OR
                </span>

                <div className="h-px flex-1 bg-[#e6d7c0]" />
              </div>

              {/* ------------------------------------------------------------ */}
              {/* Email / Password Login                                        */}
              {/* ------------------------------------------------------------ */}

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Error */}
                {error && (
                  <div className="p-3 bg-[#f9dfd5] text-[#8f3522] text-sm rounded-lg flex items-start gap-2 border border-[#f4c7be]">
                    <Shield size={16} className="flex-shrink-0 mt-0.5" />

                    <span>{error}</span>
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-[#7d6651] uppercase tracking-wider mb-1.5 ml-1">
                    Email Address
                  </label>

                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading || oauthLoading !== null}
                    className="w-full px-4 py-3 bg-[#fff5ea] border border-[#e5d1bb] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c88a3f] focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="name@company.com"
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 ml-1">
                    <label className="block text-xs font-bold text-[#7d6651] uppercase tracking-wider">
                      Password
                    </label>

                    <button
                      type="button"
                      onClick={() => setView("reset")}
                      disabled={loading || oauthLoading !== null}
                      className="text-xs text-[#b67031] hover:text-[#9b5c27] font-semibold transition-colors disabled:opacity-50"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading || oauthLoading !== null}
                      className="w-full px-4 py-3 bg-[#fff5ea] border border-[#e5d1bb] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c88a3f] focus:bg-white transition-all pr-12 disabled:opacity-60 disabled:cursor-not-allowed"
                      placeholder="••••••••"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading || oauthLoading !== null}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 disabled:opacity-50"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Sign In */}
                <button
                  type="submit"
                  disabled={loading || oauthLoading !== null}
                  className="w-full bg-[#b67031] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-[#b67031]/20 hover:bg-[#9b5c27] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Sign In
                      <ArrowRight
                        size={18}
                        className="group-hover:translate-x-1 transition-transform"
                      />
                    </>
                  )}
                </button>
              </form>

              {/* Security message */}
              <div className="mt-8 pt-8 border-t border-[#e6d7c0] text-center">
                <p className="text-xs text-[#7d6651] leading-relaxed">
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
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#b47b3b]/10 rounded-xl flex items-center justify-center">
                  <KeyRound size={20} className="text-[#b67031]" />
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-[#3a230f]">
                    Forgot password?
                  </h2>

                  <p className="text-xs text-[#7d6651]">
                    Enter your email and we'll send a reset link.
                  </p>
                </div>
              </div>

              {/* Reset success */}
              {resetSuccess ? (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <CheckCircle2 size={48} className="text-green-500" />

                  <p className="text-[#3a230f] font-bold text-base">
                    Check your email
                  </p>

                  <p className="text-sm text-[#7d6651]">
                    If <strong>{resetEmail}</strong> is registered, a reset link
                    has been sent. It expires in 15 minutes.
                  </p>

                  <button
                    onClick={goToLogin}
                    className="mt-2 w-full bg-[#b67031] text-white py-3.5 rounded-xl font-bold text-sm hover:bg-[#9b5c27] transition-all flex items-center justify-center gap-2 group"
                  >
                    Back to Sign In
                    <ArrowRight
                      size={18}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </button>
                </div>
              ) : (
                /* Reset form */
                <form onSubmit={handleReset} className="space-y-4">
                  {/* Reset error */}
                  {resetError && (
                    <div className="p-3 bg-[#f9dfd5] text-[#8f3522] text-sm rounded-lg flex items-start gap-2 border border-[#f4c7be]">
                      <Shield size={16} className="flex-shrink-0 mt-0.5" />

                      <span>{resetError}</span>
                    </div>
                  )}

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold text-[#7d6651] uppercase tracking-wider mb-1.5 ml-1">
                      Email Address
                    </label>

                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-[#fff5ea] border border-[#e5d1bb] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c88a3f] focus:bg-white transition-all"
                      placeholder="name@company.com"
                    />
                  </div>

                  {/* Send reset link */}
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full bg-[#b67031] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-[#b67031]/20 hover:bg-[#9b5c27] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {resetLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Send Reset Link"
                    )}
                  </button>

                  {/* Back */}
                  <button
                    type="button"
                    onClick={goToLogin}
                    className="w-full py-3 text-[#7d6651] font-semibold text-sm hover:text-[#3a230f] transition-colors"
                  >
                    ← Back to Sign In
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
