import { useState } from "react";
import { Briefcase, Eye, EyeOff, ArrowRight, Shield } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error)
        setError(
          error.message || "Login failed. Please check your credentials.",
        );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#281a10] via-[#1a110a] to-[#0b0704] flex">
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
              {
                label: "Security",
                value: "Invite-only",
                sub: "protected access",
              },
              { label: "AI Match Rate", value: "92%", sub: "accuracy" },
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

      <div className="flex-1 lg:max-w-md flex items-center justify-center px-6 py-12 bg-[#f7efe4]">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-[#b47b3b] rounded-lg flex items-center justify-center shadow-sm shadow-[#9b713e]/25">
              <Briefcase size={16} className="text-white" />
            </div>
            <span className="font-bold text-[#3a230f]">ZorHire</span>
          </div>

          <h2 className="text-2xl font-bold text-[#3a230f] mb-1">
            Welcome back
          </h2>
          <p className="text-sm text-[#7d6651] mb-8">
            Please enter your credentials to access the platform.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-[#f9dfd5] text-[#8f3522] text-sm rounded-lg flex items-start gap-2 border border-[#f4c7be] animate-shake">
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
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                Password
              </label>
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
                  <ArrowRight
                    size={18}
                    className="group-hover:translate-x-1 transition-transform"
                  />
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
        </div>
      </div>
    </div>
  );
}
