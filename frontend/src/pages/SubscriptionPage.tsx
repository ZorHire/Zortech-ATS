import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  CreditCard,
  Loader2,
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

function daysLeft(dateStr: string) {
  return Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);

  useEffect(() => {
    Promise.all([
      billingService.getCurrentSubscription().catch(() => null),
      billingService.getTransactions(),
    ]).then(([s, txns]) => {
      setSub(s);
      setTransactions(txns);
    }).finally(() => setLoading(false));
  }, []);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await billingService.cancelSubscription();
      setSub((prev) => (prev ? { ...prev, status: "cancelled" } : null));
      setConfirmCancel(false);
    } catch (err: any) {
      alert(err?.message || "Failed to cancel subscription.");
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

  const statusBadge = sub
    ? sub.status === "active"
      ? { label: "Active", cls: "bg-emerald-50 text-emerald-700" }
      : sub.status === "cancelled"
        ? { label: "Cancelled", cls: "bg-red-50 text-red-600" }
        : { label: sub.status, cls: "bg-gray-100 text-gray-600" }
    : null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
        <div>
          <h1 className="text-xl font-black text-gray-900">Subscription</h1>
          <p className="text-xs text-gray-400 mt-0.5">Your ZorHire plan, billing cycle, and renewal details</p>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${statusBadge.cls}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
              {statusBadge.label}
            </span>
          )}
          <button
            onClick={() => navigate("/pricing")}
            className="flex items-center gap-2 bg-[#111111] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-black transition-all"
          >
            <ArrowRight size={14} /> View Plans
          </button>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-gray-300" />
          </div>
        ) : sub && sub.status === "active" ? (

          /* ── Active Plan Card ── */
          <div className="relative rounded-[28px] overflow-hidden shadow-lg bg-white border border-gray-100">
            <div className="absolute top-0 left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-1.5 bg-amber-200 text-[#111111] text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-b-2xl">
                <Zap size={10} className="fill-[#111111]" />
                Active Plan
              </div>
            </div>

            <div className="p-7 pt-11">
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                {/* Plan name + price */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">
                      {PLAN_LABELS[sub.plan_type]}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700">
                      Active
                    </span>
                    <span className="text-[10px] font-bold capitalize px-3 py-1.5 rounded-full bg-blue-50 text-blue-700">
                      {sub.billing_cycle}
                    </span>
                  </div>

                  {price && (
                    <div>
                      <div className="flex items-end gap-1.5">
                        <span className="text-4xl font-black tracking-tight text-[#111111]">
                          ₹{price.toLocaleString("en-IN")}
                        </span>
                        <span className="text-sm font-bold mb-1.5 text-gray-400">
                          /user/mo
                        </span>
                      </div>
                      {sub.billing_cycle === "yearly" && (
                        <p className="text-[11px] font-bold mt-0.5 text-emerald-600">
                          Annual billing · ~15% savings applied
                        </p>
                      )}
                      {planMeta && (
                        <p className="text-[11px] font-medium mt-1 text-gray-400">
                          {planMeta.user_max
                            ? `${planMeta.user_min}–${planMeta.user_max} users`
                            : `${planMeta.user_min}+ users`}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Dates */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2.5 text-sm text-gray-500">
                    <Calendar size={14} className="flex-shrink-0" />
                    <span className="font-medium w-24">Member since</span>
                    <span className="font-bold text-right text-[#111111]">
                      {fmt(sub.start_date)}
                    </span>
                  </div>

                  {sub.end_date && (
                    <div className="flex items-center gap-2.5 text-sm text-gray-500">
                      <RefreshCw size={14} className="flex-shrink-0" />
                      <span className="font-medium w-24">Renews on</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-600">
                          {fmt(sub.end_date)}
                        </span>
                        {renewDays !== null && renewDays > 0 && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                            {renewDays}d left
                          </span>
                        )}
                        {renewDays !== null && renewDays <= 0 && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                            Expired
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 text-sm text-gray-500">
                    <CreditCard size={14} className="flex-shrink-0" />
                    <span className="font-medium w-24">Next charge</span>
                    <span className="font-bold text-[#111111]">
                      {sub.end_date ? fmt(sub.end_date) : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action row */}
              <div
                className="flex flex-wrap items-center gap-3 mt-6 pt-5 border-t border-dashed"
                style={{ borderColor: "#f3f4f6" }}
              >
                <button
                  onClick={() => navigate("/pricing")}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black transition-all hover:scale-[1.02] active:scale-100 bg-[#111111] text-white shadow-xl shadow-gray-200"
                >
                  <ArrowRight size={14} />
                  Change Plan
                </button>

                {!confirmCancel ? (
                  <button
                    onClick={() => setConfirmCancel(true)}
                    className="px-5 py-2.5 rounded-2xl text-sm font-bold transition-all text-red-500 hover:bg-red-50"
                  >
                    Cancel subscription
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-600">
                      Sure?
                    </span>
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-all"
                    >
                      {cancelling && (
                        <Loader2 size={11} className="animate-spin" />
                      )}
                      Yes, Cancel
                    </button>
                    <button
                      onClick={() => setConfirmCancel(false)}
                      className="px-4 py-2 rounded-xl text-xs font-black transition-all bg-gray-100 text-gray-600"
                    >
                      Keep Plan
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

        ) : sub && sub.status === "cancelled" ? (
          /* ── Cancelled state ── */
          <div className="bg-white border border-gray-100 rounded-[28px] p-8 shadow-sm text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <div>
              <h3 className="font-black text-[#111111] text-lg">
                Subscription Cancelled
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Your {PLAN_LABELS[sub.plan_type]} plan was cancelled
                {sub.end_date
                  ? `. Access continues until ${fmt(sub.end_date)}`
                  : ""}
                .
              </p>
            </div>
            <button
              onClick={() => navigate("/pricing")}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl bg-[#111111] text-white text-sm font-black hover:scale-[1.02] transition-all shadow-xl shadow-gray-200"
            >
              Reactivate Plan
            </button>
          </div>
        ) : (
          /* ── No subscription ── */
          <div className="bg-white border border-gray-100 rounded-[28px] p-10 shadow-sm text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 flex items-center justify-center">
              <CreditCard size={24} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#111111]">
                No Active Subscription
              </h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                Choose a plan to unlock the full power of ZorHire for your
                team.
              </p>
            </div>
            <button
              onClick={() => navigate("/pricing")}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-[#111111] text-white text-sm font-black hover:scale-[1.02] transition-all shadow-xl shadow-gray-200"
            >
              View Plans
            </button>
          </div>
        )}

        {/* ── Plan Features ── */}
        {sub && sub.status === "active" && planMeta && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Users, label: "User Seats", value: planMeta.user_max ? `Up to ${planMeta.user_max}` : `${planMeta.user_min}+`, color: "text-blue-600", bg: "bg-blue-50" },
              { icon: Zap,   label: "Plan Tier",  value: PLAN_LABELS[sub.plan_type], color: "text-amber-600", bg: "bg-amber-50" },
              { icon: CheckCircle2, label: "Billing", value: sub.billing_cycle === "yearly" ? "Annual · 15% off" : "Monthly", color: "text-emerald-600", bg: "bg-emerald-50" },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={18} className={color} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
                  <p className="text-base font-black text-gray-900 mt-0.5">{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Billing Details Table ── */}
        {sub && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h3 className="text-sm font-black text-gray-900">Current Subscription</h3>
              <p className="text-xs text-gray-400 mt-0.5">Active plan record</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    {["Plan", "Cycle", "Period", "Status"].map((h) => (
                      <th key={h} className="px-6 py-3.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-6 py-4">
                      <span className="font-bold text-[#111111]">{PLAN_LABELS[sub.plan_type]}</span>
                      {price && (
                        <span className="ml-2 text-xs text-gray-400 font-medium">
                          ₹{price.toLocaleString("en-IN")}/user/mo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 capitalize text-gray-600 font-medium">{sub.billing_cycle}</td>
                    <td className="px-6 py-4 text-gray-600 font-medium text-[13px]">
                      {fmt(sub.start_date)}
                      {sub.end_date && <span className="text-gray-400"> → {fmt(sub.end_date)}</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        sub.status === "active" ? "bg-emerald-50 text-emerald-700"
                          : sub.status === "cancelled" ? "bg-red-50 text-red-600"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {sub.status}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Payment Transaction History ── */}
        {transactions.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h3 className="text-sm font-black text-gray-900">Payment History</h3>
              <p className="text-xs text-gray-400 mt-0.5">All Razorpay transactions for your account</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    {["Date", "Plan", "Cycle", "Amount", "Payment ID", "Status"].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-gray-50/40 transition-colors">
                      <td className="px-5 py-3.5 text-[13px] text-gray-500 whitespace-nowrap">
                        {new Date(txn.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-[#111111] capitalize">{txn.plan_type}</span>
                      </td>
                      <td className="px-5 py-3.5 capitalize text-gray-600 text-[13px]">{txn.billing_cycle}</td>
                      <td className="px-5 py-3.5 font-bold text-[#111111] whitespace-nowrap">
                        ₹{(txn.amount / 100).toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-3.5 text-[12px] font-mono text-gray-400">
                        {txn.razorpay_payment_id
                          ? <span title={txn.razorpay_payment_id}>{txn.razorpay_payment_id.slice(0, 18)}…</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                          txn.status === "captured" ? "bg-emerald-50 text-emerald-700"
                            : txn.status === "pending" ? "bg-amber-50 text-amber-700"
                            : txn.status === "failed" ? "bg-red-50 text-red-600"
                            : "bg-gray-100 text-gray-500"
                        }`}>
                          {txn.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
