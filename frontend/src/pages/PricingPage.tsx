import { lazy, Suspense } from "react";
import { CreditCard, Headphones, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { setSubscription } from "../store/slices/subscriptionSlice";
import { useNotify } from "../hooks/useNotify";
import { Badge, buttonClasses, LoadingBlock, PageHeader } from "../components/ui";

const PricingCards = lazy(
  () => import("../components/subscription/PricingCards"),
);

export default function PricingPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const notify = useNotify();

  const handleSubscribed = () => {
    // Unlock the app straight away; previously the subscription gate still
    // saw the old "inactive" state and bounced the user back to /pricing.
    dispatch(setSubscription({ active: true, isPlatformOwner: false, reason: null }));
    notify.success("Payment received. Your ZorHire plan is active.");
    navigate("/onboarding");
  };

  return (
    <>
      <PageHeader
        title="Subscription Plans"
        subtitle="Choose the plan that fits your hiring needs"
        actions={<Badge tone="success">No setup fees</Badge>}
      />

      <div className="space-y-8 p-4 sm:p-6 lg:p-8">
        {/* Trust banner */}
        <div className="flex items-center gap-4 rounded-xl border border-navy-100 bg-navy-50 px-5 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-navy-600">
            <ShieldCheck size={16} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">
              All plans include 24/7 support, regular updates, and bank-level security.
            </p>
            <p className="mt-0.5 text-sm text-muted">You can upgrade, downgrade or cancel at any time.</p>
          </div>
        </div>

        {/* Pricing cards */}
        <Suspense fallback={<LoadingBlock label="Loading plans…" />}>
          <PricingCards onSubscribed={handleSubscribed} />
        </Suspense>

        {/* Bottom trust section */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Secure Payments */}
          <div className="zh-card flex items-start gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <CreditCard size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="mb-1 text-sm font-semibold text-ink">Secure Payments</p>
              <p className="mb-2.5 text-sm text-muted">All payments are securely processed by Razorpay.</p>
              <ul className="space-y-1.5">
                {[
                  "SSL encrypted transactions",
                  "Cards, UPI, Netbanking supported",
                  "GST invoice provided",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-1.5 text-sm text-ink-soft">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success-600" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Razorpay branding */}
          <div className="zh-card flex flex-col items-center justify-center gap-1 p-5 text-center">
            <p className="text-xs font-medium text-muted">Powered by</p>
            <p className="text-2xl font-semibold tracking-tight text-navy-800">Razorpay</p>
            <p className="text-sm text-muted">India's leading payment gateway</p>
          </div>

          {/* Need Help Choosing? */}
          <div className="zh-card flex items-start gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
              <Headphones size={18} aria-hidden="true" />
            </div>
            <div className="flex-1">
              <p className="mb-1 text-sm font-semibold text-ink">Need Help Choosing?</p>
              <p className="mb-3 text-sm text-muted">Our team is here to help you find the perfect plan.</p>
              <a
                href="mailto:tech@zortechs.in?subject=Plan%20Inquiry"
                target="_blank"
                rel="noreferrer"
                className={buttonClasses("primary", "sm", "w-full")}
              >
                Talk to Sales
              </a>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="pb-2 text-center text-sm text-muted">Prices are exclusive of applicable taxes.</p>
      </div>
    </>
  );
}
