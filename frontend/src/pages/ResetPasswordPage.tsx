import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Briefcase, Eye, EyeOff, Shield, CheckCircle2, AlertTriangle } from "lucide-react";
import { useResetPasswordMutation } from "../store/api/authApi";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [resetPassword, { isLoading: loading }] = useResetPasswordMutation();

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#281a10] via-[#1a110a] to-[#0b0704] flex items-center justify-center px-6">
        <div className="bg-[#f7efe4] rounded-2xl p-10 max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle size={22} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-[#3a230f]">Invalid Link</h2>
          <p className="text-sm text-[#7d6651]">This password reset link is missing or malformed.</p>
          <button
            onClick={() => navigate("/login")}
            className="w-full bg-[#b67031] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#9b5c27] transition-all"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await resetPassword({ token, newPassword }).unwrap();
      setSuccess(true);
    } catch (err: any) {
      setError(err?.data?.message || err?.message || "Failed to reset password. The link may have expired.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#281a10] via-[#1a110a] to-[#0b0704] flex items-center justify-center px-6">
      <div className="bg-[#f7efe4] rounded-2xl p-10 max-w-sm w-full space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-[#b47b3b] rounded-lg flex items-center justify-center">
            <Briefcase size={16} className="text-white" />
          </div>
          <span className="font-bold text-[#3a230f]">ZorHire</span>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 size={48} className="text-green-500" />
            <p className="text-[#3a230f] font-bold text-base">Password updated!</p>
            <p className="text-sm text-[#7d6651]">You can now sign in with your new password.</p>
            <button
              onClick={() => navigate("/login")}
              className="w-full bg-[#b67031] text-white py-3.5 rounded-xl font-bold text-sm hover:bg-[#9b5c27] transition-all"
            >
              Sign In
            </button>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-2xl font-bold text-[#3a230f]">Set new password</h2>
              <p className="text-xs text-[#7d6651] mt-1">Choose a strong password for your account.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-[#f9dfd5] text-[#8f3522] text-sm rounded-lg flex items-start gap-2 border border-[#f4c7be]">
                  <Shield size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#7d6651] uppercase tracking-wider mb-1.5 ml-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-[#fff5ea] border border-[#e5d1bb] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c88a3f] focus:bg-white transition-all pr-12"
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7d6651] uppercase tracking-wider mb-1.5 ml-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-[#fff5ea] border border-[#e5d1bb] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c88a3f] focus:bg-white transition-all pr-12"
                    placeholder="Re-enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#b67031] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-[#b67031]/20 hover:bg-[#9b5c27] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                ) : (
                  "Update Password"
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full py-3 text-[#7d6651] font-semibold text-sm hover:text-[#3a230f] transition-colors"
              >
                ← Back to Sign In
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
