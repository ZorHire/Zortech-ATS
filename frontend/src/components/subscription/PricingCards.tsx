import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X, Zap } from "lucide-react";
import { Button } from "../ui";
import { useNotify } from "../../hooks/useNotify";
import {
  PLANS,
  Plan,
  PlanType,
  BillingCycle,
  Subscription,
  billingService,
  RazorpayOrderResponse,
} from "../../services/billing.service";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface PricingCardsProps {
  onSubscribed?: (subscription: Subscription) => void;
  publicMode?: boolean;
}

export default function PricingCards({ onSubscribed, publicMode = false }: PricingCardsProps) {
  const notify = useNotify();
  const navigate = useNavigate();
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [currentSub, setCurrentSub] = useState<Subscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(!publicMode);
  const [subscribing, setSubscribing] = useState<PlanType | null>(null);

  useEffect(() => {
    if (publicMode) return;
    billingService
      .getCurrentSubscription()
      .then((sub) => setCurrentSub(sub))
      .finally(() => setLoadingSub(false));
  }, [publicMode]);

  const handleSubscribe = async (plan: Plan) => {
    if (publicMode) {
      // Prospects can't self-register; new companies start with a demo.
      navigate("/book-demo");
      return;
    }
    if (plan.id === "enterprise") {
      window.open("mailto:tech@zortechs.in?subject=Enterprise Plan Inquiry", "_blank");
      return;
    }
    setSubscribing(plan.id);
    try {
      const order: RazorpayOrderResponse = await billingService.subscribe(plan.id, billing);

      const loaded = await loadRazorpayScript();
      if (!loaded) {
        notify.error("Failed to load payment gateway. Please check your connection and try again.");
        setSubscribing(null);
        return;
      }

      const rzp = new (window as any).Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: "ZorHire",
        description: `${plan.name} – ${billing} billing`,
        theme: { color: "#1A4277" }, // ZorTech navy (Razorpay needs a hex value)
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const { subscription } = await billingService.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan_type: order.plan_type,
              billing_cycle: order.billing_cycle,
            });
            setCurrentSub(subscription);
            onSubscribed?.(subscription);
          } catch (err: any) {
            notify.error(err?.message || "Payment verification failed. Please contact support.");
          } finally {
            setSubscribing(null);
          }
        },
        modal: {
          ondismiss: () => setSubscribing(null),
        },
      });
      rzp.open();
    } catch (err: any) {
      notify.error(err?.message || "Failed to initiate payment. Please try again.");
      setSubscribing(null);
    }
  };

  const isCurrentPlan = (planId: PlanType) =>
    currentSub?.status === "active" && currentSub.plan_type === planId;

  const planOrder: PlanType[] = ["starter", "growth", "enterprise"];
  const currentPlanIndex = currentSub
    ? planOrder.indexOf(currentSub.plan_type)
    : -1;

  const isDowngrade = (planId: PlanType) => {
    if (!currentSub || currentSub.status !== "active") return false;
    return planOrder.indexOf(planId) < currentPlanIndex;
  };

  const getButtonLabel = (plan: Plan) => {
    if (subscribing === plan.id) return "Processing…";
    if (publicMode) return "Book a demo";
    if (plan.id === "enterprise") return "Contact Sales";
    if (isCurrentPlan(plan.id)) return "Current Plan";
    if (isDowngrade(plan.id)) return "Downgrade";
    if (currentSub?.status === "active") return "Upgrade";
    return "Get Started";
  };

  // Yearly savings come from the plan data, so the badge never over-promises.
  const yearlySavings = PLANS.map((p) =>
    p.price_monthly > 0 ? Math.round(((p.price_monthly - p.price_yearly) / p.price_monthly) * 100) : 0,
  ).filter((s) => s > 0);
  const maxSaving = yearlySavings.length ? Math.max(...yearlySavings) : 0;
  const minSaving = yearlySavings.length ? Math.min(...yearlySavings) : 0;
  const savingsLabel =
    maxSaving === 0
      ? null
      : minSaving === maxSaving
        ? `Save ${maxSaving}%`
        : `Save up to ${maxSaving}%`;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      {/* Header */}
      <div className="space-y-3 text-center">
        <p className="text-sm font-semibold text-brand-700">Pricing</p>
        <h2 className="text-3xl font-semibold leading-tight tracking-tight text-navy-800 sm:text-4xl">
          Choose Your Plan
        </h2>
        <p className="mx-auto max-w-sm text-sm text-muted">
          Scale your recruitment operations with transparent, per-user pricing.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className={`text-sm font-semibold transition-colors ${billing === "monthly" ? "text-ink" : "text-muted"}`}>
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={billing === "yearly"}
          onClick={() => setBilling(billing === "monthly" ? "yearly" : "monthly")}
          className={`relative h-6 w-12 rounded-full transition-colors duration-200 ${
            billing === "yearly" ? "bg-navy-600" : "bg-line-strong"
          }`}
          aria-label="Bill yearly"
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
              billing === "yearly" ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold transition-colors ${billing === "yearly" ? "text-ink" : "text-muted"}`}>
            Yearly
          </span>
          <span className="rounded-full border border-success-600/20 bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-700">
            {savingsLabel ?? "Save with yearly billing"}
          </span>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-3">
        {PLANS.map((plan) => {
          const price =
            billing === "monthly" ? plan.price_monthly : plan.price_yearly;
          const isCurrent = isCurrentPlan(plan.id);
          const isDowngrading = isDowngrade(plan.id);
          const isRecommended = plan.recommended;
          const saving =
            plan.price_monthly > 0
              ? Math.round(((plan.price_monthly - plan.price_yearly) / plan.price_monthly) * 100)
              : 0;

          const variant = isCurrent || isDowngrading || plan.id === "enterprise" ? "secondary" : isRecommended ? "primary" : "secondary";

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col overflow-hidden rounded-xl bg-white transition-shadow hover:shadow-pop ${
                isRecommended ? "border-2 border-navy-600 shadow-pop" : "border border-line shadow-card"
              }`}
            >
              {isRecommended && (
                <div className="flex items-center justify-center gap-1.5 bg-navy-600 px-4 py-1.5 text-xs font-semibold text-white">
                  <Zap size={12} aria-hidden="true" className="fill-brand-400 text-brand-400" />
                  Most Recommended
                </div>
              )}

              <div className="p-6 sm:p-7">
                {/* Plan name & description */}
                <div className="mb-6 space-y-1">
                  <h3 className="text-lg font-semibold text-navy-800">{plan.name}</h3>
                  <p className="text-sm text-muted">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="mb-1">
                  <div className="flex flex-wrap items-end gap-1">
                    <span className="text-4xl font-semibold tracking-tight text-ink">
                      ₹{price.toLocaleString("en-IN")}
                    </span>
                    <span className="mb-1.5 text-sm font-medium text-muted">/user/mo</span>
                  </div>
                  {billing === "yearly" && (
                    <p className="text-xs font-semibold text-success-700">
                      billed yearly{saving > 0 ? ` · saves ${saving}%` : ""}
                    </p>
                  )}
                </div>

                {/* User range */}
                <p className="mb-6 mt-1 text-xs font-medium text-muted">
                  {plan.user_max
                    ? `${plan.user_min}–${plan.user_max} users`
                    : `${plan.user_min}+ users`}
                </p>

                {/* CTA button */}
                <Button
                  variant={variant}
                  size="lg"
                  fullWidth
                  onClick={() => handleSubscribe(plan)}
                  disabled={isCurrent || isDowngrading || subscribing !== null}
                  loading={subscribing === plan.id}
                  loadingText="Processing…"
                >
                  {getButtonLabel(plan)}
                </Button>
              </div>

              <div className="mx-6 h-px bg-line sm:mx-7" />

              {/* Features list */}
              <ul className="flex-1 space-y-3 p-6 pt-5 sm:p-7 sm:pt-5">
                {plan.features.map((feature) => (
                  <li key={feature.label} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                        feature.included ? "bg-success-50 text-success-600" : "bg-surface-sunken text-muted"
                      }`}
                    >
                      {feature.included ? (
                        <Check size={10} strokeWidth={3} aria-hidden="true" />
                      ) : (
                        <X size={10} strokeWidth={3} aria-hidden="true" />
                      )}
                    </span>
                    <span
                      className={`text-sm leading-relaxed ${
                        feature.included ? "text-ink-soft" : "text-muted line-through"
                      }`}
                    >
                      <span className="sr-only">{feature.included ? "Included: " : "Not included: "}</span>
                      {feature.label}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Current plan indicator */}
              {!loadingSub && isCurrent && (
                <div className="mx-6 mb-5 rounded-lg bg-success-50 px-4 py-2.5 text-center text-sm font-semibold text-success-700 sm:mx-7">
                  Your current plan
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <p className="text-center text-sm text-muted">
        All prices in INR · Billed per user per month · Minimum{" "}
        <span className="font-semibold text-ink-soft">5 users</span> for Starter ·
        Annual billing discounts applied upfront
      </p>
    </div>
  );
}
