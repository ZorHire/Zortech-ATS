import { useState } from 'react';
import { KeyRound, Lock, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useChangePasswordMutation } from '../store/api/authApi';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { clearCredentials } from '../store/slices/authSlice';
import { baseApi, describeApiError } from '../store/api/baseApi';

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-10 rounded-3xl shadow-xl shadow-blue-100/50 max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto">
            <ShieldCheck size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Password Changed!</h2>
          <p className="text-gray-500">Your password has been updated successfully. Taking you to ZorHire…</p>
          <div className="w-full bg-emerald-500 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-200 h-full animate-progress" style={{ width: '100%' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-3xl shadow-xl shadow-blue-100/50 max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <KeyRound size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Update Password</h2>
          <p className="text-sm text-gray-500 mt-2">
            For security reasons, you must change your password before continuing.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl flex items-start gap-3 border border-red-100">
            <AlertCircle size={18} className="flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="cp-current" className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Current Password</label>
            <div className="relative">
              <input
                id="cp-current"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                placeholder="Enter current password"
              />
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-50">
            <label htmlFor="cp-new" className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">New Password</label>
            <div className="relative">
              <input
                id="cp-new"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                placeholder="Min. 8 characters"
              />
              <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div>
            <label htmlFor="cp-confirm" className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Confirm New Password</label>
            <div className="relative">
              <input
                id="cp-confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                placeholder="Repeat new password"
              />
              <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 group"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Update Password
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
        <button
          type="button"
          onClick={() => dispatch(clearCredentials())}
          className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-800"
        >
          Not you? Sign out
        </button>
      </div>
    </div>
  );
}
