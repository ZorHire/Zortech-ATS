import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  CreditCard,
  RefreshCw,
  AlertTriangle,
  Zap,
  ArrowRight,
  CheckCircle2,
  Users,
} from "lucide-react";
import {
  Subscription,
  PaymentTransaction,
  billingService,
  PLANS,
  PlanType,
} from "../services/billing.service";
import { useNotify } from "../hooks/useNotify";
import { Badge, Button, EmptyState, PageHeader, Skeleton, useConfirm } from "../components/ui";
import type { BadgeTone } from "../components/ui";

const PLAN_LABELS: Record<PlanType, string> = {
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
};

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const rupees = (r: number) => `₹${r.toLocaleString("en-IN")}`;

function daysLeft(dateStr: string) {
  return Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

function statusTone(status: string): BadgeTone {
  if (status === "active" || status === "captured") return "success";
  if (status === "cancelled" || status === "failed" || status === "expired") return "danger";
  if (status === "pending") return "warning";
  return "neutral";
}

const th = "whitespace-nowrap px-5 py-3 text-left text-xs font-medium text-muted";

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const confirm = useConfirm();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [staffUsers, setStaffUsers] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      billingService.getCurrentSubscription().catch(() => null),
      billingService.getTransactions(),
      billingService.getQuote().catch(() => null),
    ]).then(([s, txns, q]) => {
      setSub(s);
      setTransactions(txns);
      setStaffUsers(q?.staff_users ?? null);
    }).finally(() => setLoading(false));
  }, []);

  const handleCancel = async () => {
    const ok = await confirm({
      title: "Cancel your subscription?",
      message: sub?.end_date
        ? `Your team keeps access until ${fmt(sub.end_date)}. You can reactivate a plan later from Pricing.`
        : "You can reactivate a plan later from Pricing.",
      confirmText: "Yes, Cancel",
      cancelText: "Keep Plan",
      danger: true,
    });
    if (!ok) return;
    setCancelling(true);
    try {
      await billingService.cancelSubscription();
      setSub((prev) => (prev ? { ...prev, status: "cancelled" } : null));
    } catch (err: any) {
      notify.error(err?.message || "Failed to cancel subscription.");
    } finally {
      setCancelling(false);
    }
  };

  const planMeta = sub ? PLANS.find((p) => p.id === sub.plan_type) : null;
  const price =
    sub && planMeta
      ? sub.billing_cycle === "yearly"
        ? planMeta.price_yearly
        : planMeta.price_monthly
      : null;
  const renewDays = sub?.end_date ? daysLeft(sub.end_date) : null;
  // A plan past its end date has ended even if the nightly job hasn't marked it yet.
  const ended =
    !!sub &&
    (sub.status === "expired" || (!!sub.end_date && new Date(sub.end_date).getTime() <= Date.now()));
  const status = ended ? "expired" : sub?.status ?? "";
  // Savings come from the plan's own prices rather than a fixed claim.
  const yearlySaving =
    planMeta && planMeta.price_monthly > 0
      ? Math.round(((planMeta.price_monthly - planMeta.price_yearly) / planMeta.price_monthly) * 100)
      : 0;

  return (
    <>
      <PageHeader
        title="Subscription"
        subtitle="Your ZorHire plan, billing cycle, and renewal details"
        actions={
          <>
            {sub && (
              <Badge tone={statusTone(status)} className="capitalize">
                {status}
              </Badge>
            )}
            <Button onClick={() => navigate("/pricing")} icon={<ArrowRight size={14} aria-hidden="true" />}>
              View Plans
            </Button>
          </>
        }
      />

      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="zh-card space-y-4 p-6" role="status" aria-label="Loading subscription">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-3.5 w-64" />
            <Skeleton className="h-3.5 w-56" />
          </div>
        ) : sub && status === "active" ? (

          /* ── Active Plan Card ── */
          <div className="zh-card overflow-hidden">
            <div className="flex items-center gap-1.5 bg-navy-600 px-5 py-2 text-xs font-semibold text-white">
              <Zap size={12} aria-hidden="true" className="fill-brand-400 text-brand-400" />
              Active Plan
            </div>

            <div className="p-5 sm:p-7">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                {/* Plan name + price */}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="navy">{PLAN_LABELS[sub.plan_type]}</Badge>
                    <Badge tone="success">Active</Badge>
                    <Badge tone="neutral" className="capitalize">{sub.billing_cycle}</Badge>
                  </div>

                  {price && (
                    <div>
                      <div className="flex items-end gap-1.5">
                        <span className="text-4xl font-semibold tracking-tight text-ink">
                          ₹{price.toLocaleString("en-IN")}
                        </span>
                        <span className="mb-1.5 text-sm font-medium text-muted">/user/mo</span>
                      </div>
                      {sub.billing_cycle === "yearly" && (
                        <p className="mt-0.5 text-xs font-semibold text-success-700">
                          {yearlySaving > 0
                            ? `Annual billing · ${yearlySaving}% savings applied`
                            : "Annual billing"}
                        </p>
                      )}
                      {sub.seats ? (
                        <p className="mt-1 text-xs text-muted">
                          {sub.seats} users paid ·{" "}
                          {rupees(price * sub.seats * (sub.billing_cycle === "yearly" ? 12 : 1))}
                          {sub.billing_cycle === "yearly" ? " per year" : " per month"}
                        </p>
                      ) : planMeta && (
                        <p className="mt-1 text-xs text-muted">
                          {planMeta.user_max
                            ? `${planMeta.user_min}–${planMeta.user_max} users`
                            : `${planMeta.user_min}+ users`}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Dates */}
                <dl className="flex flex-col gap-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2.5 text-muted">
                    <Calendar size={14} aria-hidden="true" className="shrink-0" />
                    <dt className="w-24 font-medium">Member since</dt>
                    <dd className="font-semibold text-ink">{fmt(sub.start_date)}</dd>
                  </div>

                  {sub.end_date && (
                    <div className="flex flex-wrap items-center gap-2.5 text-muted">
                      <RefreshCw size={14} aria-hidden="true" className="shrink-0" />
                      <dt className="w-24 font-medium">Renews on</dt>
                      <dd className="flex items-center gap-2">
                        <span className="font-semibold text-ink">{fmt(sub.end_date)}</span>
                        {renewDays !== null && renewDays > 0 && (
                          <Badge tone="warning">{renewDays}d left</Badge>
                        )}
                        {renewDays !== null && renewDays <= 0 && (
                          <Badge tone="danger">Expired</Badge>
                        )}
                      </dd>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2.5 text-muted">
                    <CreditCard size={14} aria-hidden="true" className="shrink-0" />
                    <dt className="w-24 font-medium">Next charge</dt>
                    <dd className="font-semibold text-ink">{sub.end_date ? fmt(sub.end_date) : "—"}</dd>
                  </div>
                </dl>
              </div>

              {sub.seats != null && staffUsers != null && staffUsers > sub.seats && (
                <p className="mt-5 rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning-700">
                  You now have {staffUsers} team members and have paid for {sub.seats}. The extra{" "}
                  {staffUsers - sub.seats === 1 ? "user is" : `${staffUsers - sub.seats} users are`} billed from
                  your next renewal{sub.end_date ? ` on ${fmt(sub.end_date)}` : ""}.
                </p>
              )}

              {/* Action row */}
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-dashed border-line pt-5">
                <Button onClick={() => navigate("/pricing")} icon={<ArrowRight size={14} aria-hidden="true" />}>
                  Change Plan
                </Button>
                <Button
                  variant="ghost"
                  className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
                  onClick={handleCancel}
                  loading={cancelling}
                  loadingText="Cancelling…"
                >
                  Cancel subscription
                </Button>
              </div>
            </div>
          </div>

        ) : sub && status === "expired" ? (
          /* ── Plan ended: the team is blocked until it is renewed ── */
          <div className="zh-card">
            <EmptyState
              icon={<AlertTriangle size={22} aria-hidden="true" className="text-danger-600" />}
              title="Your plan has ended"
              description={`Your ${PLAN_LABELS[sub.plan_type]} plan ended${
                sub.end_date ? ` on ${fmt(sub.end_date)}` : ""
              } and wasn't renewed, so your team is blocked from ZorHire. Renew to unlock everyone straight away.`}
              action={<Button onClick={() => navigate("/pricing")}>Renew plan</Button>}
            />
          </div>
        ) : sub && sub.status === "cancelled" ? (
          /* ── Cancelled state ── */
          <div className="zh-card">
            <EmptyState
              icon={<AlertTriangle size={22} aria-hidden="true" className="text-danger-600" />}
              title="Subscription Cancelled"
              description={`Your ${PLAN_LABELS[sub.plan_type]} plan was cancelled${
                sub.end_date ? `. Access continues until ${fmt(sub.end_date)}` : ""
              }.`}
              action={<Button onClick={() => navigate("/pricing")}>Reactivate Plan</Button>}
            />
          </div>
        ) : (
          /* ── No subscription ── */
          <div className="zh-card">
            <EmptyState
              icon={<CreditCard size={22} aria-hidden="true" />}
              title="No Active Subscription"
              description="Choose a plan to unlock the full power of ZorHire for your team."
              action={<Button onClick={() => navigate("/pricing")}>View Plans</Button>}
            />
          </div>
        )}

        {/* ── Plan Features ── */}
        {sub && status === "active" && planMeta && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                icon: Users,
                label: "User Seats",
                value: sub.seats
                  ? `${sub.seats} paid${staffUsers != null ? ` · ${staffUsers} in use` : ""}`
                  : planMeta.user_max ? `Up to ${planMeta.user_max}` : `${planMeta.user_min}+`,
                cls: "bg-navy-50 text-navy-600",
              },
              { icon: Zap, label: "Plan Tier", value: PLAN_LABELS[sub.plan_type], cls: "bg-brand-50 text-brand-700" },
              {
                icon: CheckCircle2,
                label: "Billing",
                value: sub.billing_cycle === "yearly" ? (yearlySaving > 0 ? `Annual · ${yearlySaving}% off` : "Annual") : "Monthly",
                cls: "bg-success-50 text-success-600",
              },
            ].map(({ icon: Icon, label, value, cls }) => (
              <div key={label} className="zh-card flex items-center gap-4 p-5">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cls}`}>
                  <Icon size={18} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted">{label}</p>
                  <p className="mt-0.5 text-base font-semibold text-ink">{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Billing Details Table ── */}
        {sub && (
          <div className="zh-card overflow-hidden">
            <div className="border-b border-line px-5 py-4 sm:px-6">
              <h2 className="text-sm font-semibold text-ink">Current Subscription</h2>
              <p className="mt-0.5 text-xs text-muted">Active plan record</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface">
                    {["Plan", "Cycle", "Period", "Status"].map((h) => (
                      <th key={h} scope="col" className={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="font-semibold text-ink">{PLAN_LABELS[sub.plan_type]}</span>
                      {price && (
                        <span className="ml-2 text-xs text-muted">₹{price.toLocaleString("en-IN")}/user/mo</span>
                      )}
                    </td>
                    <td className="px-5 py-4 capitalize text-ink-soft">{sub.billing_cycle}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-ink-soft">
                      {fmt(sub.start_date)}
                      {sub.end_date && <span className="text-muted"> → {fmt(sub.end_date)}</span>}
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={statusTone(status)} className="capitalize">{status}</Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Payment Transaction History ── */}
        {transactions.length > 0 && (
          <div className="zh-card overflow-hidden">
            <div className="border-b border-line px-5 py-4 sm:px-6">
              <h2 className="text-sm font-semibold text-ink">Payment History</h2>
              <p className="mt-0.5 text-xs text-muted">All Razorpay transactions for your account</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface">
                    {["Date", "Plan", "Cycle", "Amount", "Payment ID", "Status"].map((h) => (
                      <th key={h} scope="col" className={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {transactions.map((txn) => (
                    <tr key={txn.id} className="transition-colors hover:bg-surface">
                      <td className="whitespace-nowrap px-5 py-3.5 text-muted">
                        {new Date(txn.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold capitalize text-ink">{txn.plan_type}</span>
                      </td>
                      <td className="px-5 py-3.5 capitalize text-ink-soft">{txn.billing_cycle}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-ink">
                        ₹{(txn.amount / 100).toLocaleString("en-IN")}
                        {txn.seats ? <span className="ml-1.5 text-xs font-normal text-muted">{txn.seats} users</span> : null}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-muted">
                        {txn.razorpay_payment_id
                          ? <span title={txn.razorpay_payment_id}>{txn.razorpay_payment_id.slice(0, 18)}…</span>
                          : <span>—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={statusTone(txn.status)} className="capitalize">{txn.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
