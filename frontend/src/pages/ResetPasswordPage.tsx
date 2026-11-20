import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Shield, CheckCircle2, AlertTriangle } from "lucide-react";
import { useResetPasswordMutation } from "../store/api/authApi";
import { Button } from "../components/ui";

function BrandMark() {
  return (
    <div className="mb-6 flex items-center gap-3">
      <img src="/brand/zortech-logo.png" alt="ZorTech" className="h-6 w-auto" />
      <span className="border-l border-line pl-3 text-sm font-semibold text-navy-700">ZorHire</span>
    </div>
  );
}

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
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10 sm:px-6">
        <div className="zh-card w-full max-w-sm space-y-4 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
            <AlertTriangle size={22} aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold text-navy-800">Invalid Link</h1>
          <p className="text-sm text-muted">This password reset link is missing or malformed.</p>
          <Button size="lg" fullWidth onClick={() => navigate("/login")}>
            Back to Sign In
          </Button>
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
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10 sm:px-6">
      <div className="zh-card w-full max-w-sm p-6 sm:p-8">
        <BrandMark />

        {success ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center" role="status">
            <CheckCircle2 size={48} aria-hidden="true" className="text-success-600" />
            <h1 className="text-base font-semibold text-ink">Password updated!</h1>
            <p className="text-sm text-muted">You can now sign in with your new password.</p>
            <Button size="lg" fullWidth onClick={() => navigate("/login")}>
              Sign In
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-navy-800">Set new password</h1>
              <p className="mt-1 text-sm text-muted">Choose a strong password for your account.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger-600/20 bg-danger-50 p-3 text-sm text-danger-700">
                  <Shield size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="rp-new" className="zh-label">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="rp-new"
                    type={showNew ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    readOnly={loading}
                    aria-describedby="rp-new-hint"
                    className="zh-input pr-12"
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    aria-label={showNew ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-ink"
                  >
                    {showNew ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
                <p id="rp-new-hint" className="mt-1 text-xs text-muted">At least 8 characters.</p>
              </div>

              <div>
                <label htmlFor="rp-confirm" className="zh-label">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="rp-confirm"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    readOnly={loading}
                    className="zh-input pr-12"
                    placeholder="Re-enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-ink"
                  >
                    {showConfirm ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <Button type="submit" size="lg" fullWidth loading={loading} loadingText="Updating…">
                Update Password
              </Button>

              <Button variant="ghost" fullWidth onClick={() => navigate("/login")} icon={<ArrowLeft size={16} aria-hidden="true" />}>
                Back to Sign In
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
