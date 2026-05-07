import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X, Zap, Loader2 } from "lucide-react";
import {
  PLANS,
  Plan,
  PlanType,
  BillingCycle,
  Subscription,
  billingService,
} from "../../services/billing.service";

interface PricingCardsProps {
  onSubscribed?: (subscription: Subscription) => void;
  publicMode?: boolean;
}

export default function PricingCards({ onSubscribed, publicMode = false }: PricingCardsProps) {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [currentSub, setCurrentSub] = useState<Subscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(!publicMode);
  const [subscribing, setSubscribing] = useState<PlanType | null>(null);
  const [hoveredPlan, setHoveredPlan] = useState<PlanType | null>(null);

  useEffect(() => {
    if (publicMode) return;
    billingService
      .getCurrentSubscription()
      .then((sub) => setCurrentSub(sub))
      .finally(() => setLoadingSub(false));
  }, [publicMode]);

  const handleSubscribe = async (plan: Plan) => {
    if (publicMode) {
      navigate("/login");
      return;
    }
    if (plan.id === "enterprise") {
      window.open("mailto:sales@zortech.in?subject=Enterprise Plan Inquiry", "_blank");
      return;
    }
    setSubscribing(plan.id);
    try {
      const { subscription, checkout_url } = await billingService.subscribe(
        plan.id,
        billing,
      );
      if (checkout_url) {
        window.location.href = checkout_url;
        return;
      }
      setCurrentSub(subscription);
      onSubscribed?.(subscription);
    } catch (err: any) {
      alert(err?.message || "Failed to start subscription. Please try again.");
    } finally {
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
    if (plan.id === "enterprise") return "Contact Sales";
    if (publicMode) return "Get Started";
    if (isCurrentPlan(plan.id)) return "Current Plan";
    if (isDowngrade(plan.id)) return "Downgrade";
    if (currentSub?.status === "active") return "Upgrade";
    return "Get Started";
  };

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.3em]">
          Pricing
        </p>
        <h2 className="text-3xl sm:text-4xl font-black text-[#111111] tracking-tight leading-tight">
          Choose Your Plan
        </h2>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Scale your recruitment operations with transparent, per-user pricing.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <span
          className={`text-sm font-bold transition-colors ${billing === "monthly" ? "text-[#111111]" : "text-gray-400"}`}
        >
          Monthly
        </span>
        <button
          onClick={() => setBilling(billing === "monthly" ? "yearly" : "monthly")}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
            billing === "yearly" ? "bg-[#111111]" : "bg-gray-200"
          }`}
          aria-label="Toggle billing cycle"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
              billing === "yearly" ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-bold transition-colors ${billing === "yearly" ? "text-[#111111]" : "text-gray-400"}`}
          >
            Yearly
          </span>
          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
            Save ~15%
          </span>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
        {PLANS.map((plan) => {
          const price =
            billing === "monthly" ? plan.price_monthly : plan.price_yearly;
          const isCurrent = isCurrentPlan(plan.id);
          const isDowngrading = isDowngrade(plan.id);
          const isRecommended = plan.recommended;
          const isDark = hoveredPlan === plan.id;

          return (
            <div
              key={plan.id}
              onMouseEnter={() => setHoveredPlan(plan.id)}
              onMouseLeave={() => setHoveredPlan(null)}
              className={`relative flex flex-col rounded-[32px] overflow-hidden transition-all duration-200 cursor-default ${
                isDark
                  ? "bg-[#111111] shadow-2xl shadow-black/20 scale-[1.02] border border-[#333]"
                  : "bg-white border border-gray-100 shadow-lg shadow-gray-100/60"
              }`}
            >
              {/* Recommended badge */}
              {isRecommended && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                  <div className="flex items-center gap-1.5 bg-amber-200 text-[#111111] text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-b-2xl">
                    <Zap size={10} className="fill-[#111111]" />
                    Most Recommended
                  </div>
                </div>
              )}

              <div className={`p-7 ${isRecommended ? "pt-10" : ""}`}>
                {/* Plan name & description */}
                <div className="space-y-1 mb-6">
                  <p
                    className={`text-[10px] font-black uppercase tracking-[0.25em] ${
                      isDark ? "text-amber-300" : "text-gray-400"
                    }`}
                  >
                    {plan.name}
                  </p>
                  <p
                    className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}
                  >
                    {plan.description}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-1">
                  <div className="flex items-end gap-1">
                    <span
                      className={`text-4xl font-black tracking-tight ${
                        isDark ? "text-white" : "text-[#111111]"
                      }`}
                    >
                      ₹{price.toLocaleString("en-IN")}
                    </span>
                    <span className="text-sm font-bold mb-1.5 text-gray-400">
                      /user/mo
                    </span>
                  </div>
                  {billing === "yearly" && (
                    <p
                      className={`text-[11px] font-bold ${
                        isDark ? "text-amber-300" : "text-emerald-600"
                      }`}
                    >
                      billed yearly · saves{" "}
                      {Math.round(
                        ((plan.price_monthly - plan.price_yearly) /
                          plan.price_monthly) *
                          100,
                      )}
                      %
                    </p>
                  )}
                </div>

                {/* User range */}
                <p
                  className={`text-[11px] font-bold mt-1 mb-6 ${
                    isDark ? "text-gray-500" : "text-gray-400"
                  }`}
                >
                  {plan.user_max
                    ? `${plan.user_min}–${plan.user_max} users`
                    : `${plan.user_min}+ users`}
                </p>

                {/* CTA button */}
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={isCurrent || isDowngrading || subscribing !== null}
                  className={`w-full py-3.5 rounded-[18px] text-sm font-black transition-all duration-200 flex items-center justify-center gap-2 ${
                    isDark
                      ? isCurrent
                        ? "bg-white/10 text-white/50 cursor-default"
                        : isDowngrading
                          ? "bg-white/5 text-white/30 cursor-not-allowed"
                          : "bg-[#E3F2FF] text-[#111111] hover:scale-[1.02] shadow-xl shadow-blue-500/10"
                      : isCurrent
                        ? "bg-gray-50 text-gray-400 border border-gray-100 cursor-default"
                        : isDowngrading
                          ? "bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed"
                          : plan.id === "enterprise"
                            ? "bg-gray-50 text-[#111111] border border-gray-200 hover:bg-gray-100"
                            : "bg-[#111111] text-white hover:scale-[1.02] shadow-xl shadow-gray-200"
                  }`}
                >
                  {subscribing === plan.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : null}
                  {getButtonLabel(plan)}
                </button>
              </div>

              {/* Divider */}
              <div
                className={`mx-7 h-px ${isDark ? "bg-white/10" : "bg-gray-100"}`}
              />

              {/* Features list */}
              <div className="p-7 pt-5 space-y-3 flex-1">
                {plan.features.map((feature) => (
                  <div key={feature.label} className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                        feature.included
                          ? isDark
                            ? "bg-amber-300/20 text-amber-300"
                            : "bg-emerald-50 text-emerald-600"
                          : isDark
                            ? "bg-white/5 text-white/20"
                            : "bg-gray-50 text-gray-300"
                      }`}
                    >
                      {feature.included ? (
                        <Check size={9} strokeWidth={3} />
                      ) : (
                        <X size={9} strokeWidth={3} />
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium leading-relaxed ${
                        feature.included
                          ? isDark
                            ? "text-gray-300"
                            : "text-gray-700"
                          : isDark
                            ? "text-white/25 line-through"
                            : "text-gray-300 line-through"
                      }`}
                    >
                      {feature.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Current plan indicator */}
              {!loadingSub && isCurrent && (
                <div
                  className={`mx-7 mb-5 px-4 py-2.5 rounded-2xl text-center text-[11px] font-black uppercase tracking-wider ${
                    isDark
                      ? "bg-amber-300/10 text-amber-300"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  Your current plan
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-gray-400 font-medium">
        All prices in INR · Billed per user per month · Minimum{" "}
        <span className="font-bold text-gray-500">5 users</span> for Starter ·
        Annual billing discounts applied upfront
      </p>
    </div>
  );
}
