import { useState } from "react";
import { Briefcase, Eye, EyeOff, ArrowRight, Shield, KeyRound, CheckCircle2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/api";

type View = "login" | "reset";

export default function LoginPage() {
  const [view, setView] = useState<View>("login");

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  // Reset state
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error } = await signIn(email, password, "");
      if (error) setError(error.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: resetEmail });
      setResetSuccess(true);
    } catch (err: any) {
      setResetError(err?.message || "Failed to send reset link. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  const goToLogin = () => {
    setView("login");
    setResetEmail("");
    setResetError("");
    setResetSuccess(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#281a10] via-[#1a110a] to-[#0b0704] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:flex-1 flex-col justify-center px-16 py-12">
        <div className="max-w-lg">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-[#b47b3b] rounded-xl flex items-center justify-center shadow-xl shadow-[#967043]/25">
              <Briefcase size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#f6e6d2]">ZorHire</h1>
              <p className="text-[#d8b286] text-sm">Enterprise ATS Platform</p>
            </div>
          </div>

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

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Active Jobs", value: "12+", sub: "across clients" },
              { label: "Candidates", value: "5,000+", sub: "in database" },
              { label: "Security", value: "Invite-only", sub: "protected access" },
              { label: "AI Match Rate", value: "92%", sub: "accuracy" },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#1b120b]/80 border border-[#f2dbc0]/15 rounded-xl p-4">
                <p className="text-2xl font-bold text-[#f9e8d1]">{stat.value}</p>
                <p className="text-xs text-[#c2a687] mt-1">{stat.label} · {stat.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 lg:max-w-md flex items-center justify-center px-6 py-12 bg-[#f7efe4]">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-[#b47b3b] rounded-lg flex items-center justify-center shadow-sm shadow-[#9b713e]/25">
              <Briefcase size={16} className="text-white" />
            </div>
            <span className="font-bold text-[#3a230f]">ZorHire</span>
          </div>

          {view === "login" ? (
            <>
              <h2 className="text-2xl font-bold text-[#3a230f] mb-1">Welcome back</h2>
              <p className="text-sm text-[#7d6651] mb-8">Please enter your credentials to access the platform.</p>

              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div className="p-3 bg-[#f9dfd5] text-[#8f3522] text-sm rounded-lg flex items-start gap-2 border border-[#f4c7be]">
                    <Shield size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-[#7d6651] uppercase tracking-wider mb-1.5 ml-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-[#fff5ea] border border-[#e5d1bb] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c88a3f] focus:bg-white transition-all"
                    placeholder="name@company.com"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5 ml-1">
                    <label className="block text-xs font-bold text-[#7d6651] uppercase tracking-wider">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setView("reset")}
                      className="text-xs text-[#b67031] hover:text-[#9b5c27] font-semibold transition-colors"
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
                      className="w-full px-4 py-3 bg-[#fff5ea] border border-[#e5d1bb] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c88a3f] focus:bg-white transition-all pr-12"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#b67031] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-[#b67031]/20 hover:bg-[#9b5c27] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Sign In
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-8 border-t border-[#e6d7c0] text-center">
                <p className="text-xs text-[#7d6651] leading-relaxed">
                  Protected by enterprise-grade security.
                  <br />
                  Access is restricted to authorized personnel only.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#b47b3b]/10 rounded-xl flex items-center justify-center">
                  <KeyRound size={20} className="text-[#b67031]" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#3a230f]">Forgot password?</h2>
                  <p className="text-xs text-[#7d6651]">Enter your email and we'll send a reset link.</p>
                </div>
              </div>

              {resetSuccess ? (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <CheckCircle2 size={48} className="text-green-500" />
                  <p className="text-[#3a230f] font-bold text-base">Check your email</p>
                  <p className="text-sm text-[#7d6651]">
                    If <strong>{resetEmail}</strong> is registered, a reset link has been sent. It expires in 15 minutes.
                  </p>
                  <button
                    onClick={goToLogin}
                    className="mt-2 w-full bg-[#b67031] text-white py-3.5 rounded-xl font-bold text-sm hover:bg-[#9b5c27] transition-all flex items-center justify-center gap-2 group"
                  >
                    Back to Sign In
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                  {resetError && (
                    <div className="p-3 bg-[#f9dfd5] text-[#8f3522] text-sm rounded-lg flex items-start gap-2 border border-[#f4c7be]">
                      <Shield size={16} className="flex-shrink-0 mt-0.5" />
                      <span>{resetError}</span>
                    </div>
                  )}

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
