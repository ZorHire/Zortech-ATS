import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { useAppSelector } from "../../hooks/useAppSelector";
import { clearCredentials, selectCurrentUser } from "../../store/slices/authSlice";
import { selectSubscription } from "../../store/slices/subscriptionSlice";
import { formatPlanDate } from "./RenewalReminder";

const BILLING_ADMINS = ["super_admin", "accounts_manager"];

/**
 * Full-page block shown to staff once their company's plan has ended.
 * Admins can go straight to renewal; everyone else is asked to contact their admin.
 */
export default function PlanEndedScreen() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);
  const sub = useAppSelector(selectSubscription);
  const isAdmin = !!user && BILLING_ADMINS.includes(user.role);
  const ended = sub?.endDate ? ` on ${formatPlanDate(sub.endDate)}` : "";

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div role="alertdialog" aria-labelledby="plan-ended-title" className="w-full max-w-md bg-white border border-line rounded-2xl p-8 text-center shadow-sm">
        <img src="/brand/zortech-logo.png" alt="ZorTech" className="h-8 mx-auto mb-6" />
        <div className="w-12 h-12 rounded-full bg-danger-50 text-danger-700 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 id="plan-ended-title" className="text-lg font-semibold text-ink">
          Your company's ZorHire plan has ended
        </h1>
        <p className="mt-2 text-sm text-muted">
          {isAdmin
            ? `The plan ended${ended} and wasn't renewed, so your team can't use ZorHire right now. Renew it to unlock everyone straight away. Your data is safe.`
            : `The plan ended${ended} and wasn't renewed. Please ask your ZorHire admin to renew it. Your data is safe.`}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate("/subscription")}
              className="rounded-lg bg-navy-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
            >
              Renew now
            </button>
          )}
          <button
            type="button"
            onClick={() => dispatch(clearCredentials())}
            className="rounded-lg px-4 py-2 text-sm text-muted hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
