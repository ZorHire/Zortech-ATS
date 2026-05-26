import { lazy, Suspense } from "react";
import { Loader2, CreditCard, Headphones, ShieldCheck } from "lucide-react";
import { Subscription } from "../services/billing.service";
import { useNavigate } from "react-router-dom";

const PricingCards = lazy(
  () => import("../components/subscription/PricingCards"),
);

function CardsSkeleton() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={28} className="animate-spin text-gray-300" />
    </div>
  );
}

export default function PricingPage() {
  const navigate = useNavigate();

  const handleSubscribed = (_sub: Subscription) => {
    navigate("/subscription");
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Inline page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
        <div>
          <h1 className="text-base font-black text-[#111111] tracking-tight">
            Subscription Plans
          </h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
            Choose the plan that fits your hiring needs
          </p>
        </div>
        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full uppercase tracking-widest">
          No setup fees
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
        {/* Trust banner */}
        <div className="flex items-center gap-4 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-3.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={16} className="text-amber-700" />
          </div>
          <div>
            <p className="text-xs font-black text-[#111111]">
              All plans include 24/7 support, regular updates, and bank-level security.
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              You can upgrade, downgrade or cancel at any time.
            </p>
          </div>
        </div>

        {/* Pricing cards */}
        <Suspense fallback={<CardsSkeleton />}>
          <PricingCards onSubscribed={handleSubscribed} />
        </Suspense>

        {/* Bottom trust section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
          {/* Secure Payments */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <CreditCard size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-black text-[#111111] mb-1">Secure Payments</p>
              <p className="text-[11px] text-gray-500 mb-2.5">
                All payments are securely processed by Razorpay.
              </p>
              <ul className="space-y-1.5">
                {[
                  "SSL encrypted transactions",
                  "Cards, UPI, Netbanking supported",
                  "GST invoice provided",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Razorpay branding */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center justify-center gap-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Powered by
            </p>
            <p className="text-2xl font-black text-[#072654] tracking-tight">Razorpay</p>
            <p className="text-[11px] text-gray-400">India's leading payment gateway</p>
          </div>

          {/* Need Help Choosing? */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Headphones size={18} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-black text-[#111111] mb-1">Need Help Choosing?</p>
              <p className="text-[11px] text-gray-500 mb-3">
                Our team is here to help you find the perfect plan.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() =>
                    window.open(
                      "mailto:sales@zortech.in?subject=Plan%20Inquiry",
                      "_blank",
                    )
                  }
                  className="w-full py-2 rounded-xl bg-[#111111] text-white text-[11px] font-black hover:bg-black transition-colors"
                >
                  Talk to Sales
                </button>
                <button
                  onClick={() => navigate("/public-pricing")}
                  className="w-full py-2 rounded-xl border border-gray-200 text-[#111111] text-[11px] font-black hover:bg-gray-50 transition-colors"
                >
                  Compare Features →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-[11px] text-gray-400 font-medium mt-6 pb-2">
          Prices are exclusive of applicable taxes.
        </p>
      </div>
    </div>
  );
}
