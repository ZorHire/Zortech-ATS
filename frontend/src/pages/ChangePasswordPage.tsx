import { useState } from 'react';
import { KeyRound, Lock, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useChangePasswordMutation } from '../store/api/authApi';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { clearCredentials } from '../store/slices/authSlice';
import { baseApi, describeApiError } from '../store/api/baseApi';
import { Button, Spinner } from "../components/ui";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [changePassword] = useChangePasswordMutation();
  const dispatch = useAppDispatch();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword }).unwrap();
      setSuccess(true);
      // The current token stays valid, so continue into the app instead of
      // forcing a second login: refetching /auth/me clears must_change_password.
      setTimeout(() => {
        dispatch(baseApi.util.invalidateTags(['Auth']));
      }, 1200);
    } catch (err: any) {
      setError(describeApiError(err, 'Failed to change password'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-4 sm:p-6">
        <div className="zh-card w-full max-w-md space-y-5 p-8 text-center sm:p-10" role="status">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-success-50 text-success-600">
            <ShieldCheck size={32} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold text-navy-800">Password Changed!</h1>
          <p className="text-sm text-muted">Your password has been updated successfully. Taking you to ZorHire…</p>
          <Spinner size={20} tone="brand" className="mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <img src="/brand/zortech-logo.png" alt="ZorTech" className="h-6 w-auto" />
          <span className="border-l border-line pl-3 text-sm font-semibold text-navy-700">ZorHire</span>
        </div>

        <div className="zh-card space-y-7 p-6 sm:p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-navy-50 text-navy-600">
              <KeyRound size={28} aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-semibold text-navy-800">Update Password</h1>
            <p className="mt-2 text-sm text-muted">
              For security reasons, you must change your password before continuing.
            </p>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger-600/20 bg-danger-50 p-3 text-sm text-danger-700">
              <AlertCircle size={18} aria-hidden="true" className="shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="cp-current" className="zh-label">Current password</label>
              <div className="relative">
                <input
                  id="cp-current"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  readOnly={loading}
                  className="zh-input pl-10"
                  placeholder="Enter current password"
                />
                <Lock size={16} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              </div>
            </div>

            <div className="border-t border-line pt-5">
              <label htmlFor="cp-new" className="zh-label">New password</label>
              <div className="relative">
                <input
                  id="cp-new"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  readOnly={loading}
                  aria-describedby="cp-new-hint"
                  className="zh-input pl-10"
                  placeholder="Min. 8 characters"
                />
                <KeyRound size={16} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              </div>
              <p id="cp-new-hint" className="mt-1 text-xs text-muted">At least 8 characters.</p>
            </div>

            <div>
              <label htmlFor="cp-confirm" className="zh-label">Confirm new password</label>
              <div className="relative">
                <input
                  id="cp-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  readOnly={loading}
                  className="zh-input pl-10"
                  placeholder="Repeat new password"
                />
                <KeyRound size={16} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={loading}
              loadingText="Updating…"
              iconRight={<ArrowRight size={18} aria-hidden="true" />}
            >
              Update Password
            </Button>
          </form>
          <Button variant="ghost" fullWidth onClick={() => dispatch(clearCredentials())}>
            Not you? Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
