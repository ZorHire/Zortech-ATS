import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { Button, Modal } from "../ui";
import { useAppSelector } from "../../hooks/useAppSelector";
import { selectCurrentUser } from "../../store/slices/authSlice";
import { selectSubscription } from "../../store/slices/subscriptionSlice";

/** Start reminding this many days before the plan ends (matches the backend). */
export const RENEWAL_REMINDER_DAYS = 7;
const BILLING_ADMINS = ["super_admin", "accounts_manager"];
const STAFF = ["super_admin", "accounts_manager", "recruiter", "vendor_manager"];

export function formatPlanDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function dismissKey(endDate: string) {
  // One reminder per day per plan period.
  return `renewal-reminder:${endDate}:${new Date().toDateString()}`;
}

/**
 * Pops up automatically once a day in the last week of a company's plan.
 * Admins get a "Renew now" button; other staff are asked to tell their admin.
 */
export default function RenewalReminder() {
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);
  const sub = useAppSelector(selectSubscription);
  const [open, setOpen] = useState(false);

  const daysLeft = sub?.daysLeft ?? null;
  const endDate = sub?.endDate ?? null;
  const due =
    !!user && STAFF.includes(user.role) && !!sub && sub.active && !sub.isPlatformOwner &&
    endDate != null && daysLeft != null && daysLeft <= RENEWAL_REMINDER_DAYS;

  useEffect(() => {
    if (!due || !endDate) return;
    let seen = false;
    try {
      seen = localStorage.getItem(dismissKey(endDate)) === "1";
    } catch {
      /* storage blocked: show it */
    }
    if (!seen) setOpen(true);
  }, [due, endDate]);

  if (!due || !endDate || !user) return null;

  const close = () => {
    try {
      localStorage.setItem(dismissKey(endDate), "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const isAdmin = BILLING_ADMINS.includes(user.role);
  const when = daysLeft! <= 1 ? "within a day" : `in ${daysLeft} days`;
  const urgent = daysLeft! <= 2;

  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          <CalendarClock className={`h-5 w-5 ${urgent ? "text-danger-600" : "text-brand-600"}`} aria-hidden="true" />
          Your plan ends {when}
        </span>
      }
      footer={
        isAdmin ? (
          <>
            <Button variant="ghost" onClick={close}>
              Remind me tomorrow
            </Button>
            <Button
              onClick={() => {
                close();
                navigate("/subscription");
              }}
            >
              Renew now
            </Button>
          </>
        ) : (
          <Button onClick={close}>OK</Button>
        )
      }
    >
      <p className="text-sm text-ink">
        Your company's ZorHire plan ends on <strong>{formatPlanDate(endDate)}</strong>.
      </p>
      <p className="mt-2 text-sm text-muted">
        {isAdmin
          ? "Renew before then to keep your team working. If the plan isn't renewed, everyone on your team will be blocked from ZorHire until it is."
          : "Please ask your ZorHire admin to renew it. If it isn't renewed, you'll be blocked from ZorHire until it is."}
      </p>
    </Modal>
  );
}
