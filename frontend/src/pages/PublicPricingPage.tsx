import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Loader2, ArrowLeft, LogIn } from "lucide-react";

const PricingCards = lazy(
  () => import("../components/subscription/PricingCards"),
);

export default function PublicPricingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f9efe1] flex flex-col">
      {/* Top navbar */}
      <nav className="flex items-center justify-between px-6 py-4 bg-[#1d170f]">
        <button
          onClick={() => navigate("/subscribe")}
          className="flex items-center gap-2 text-[#c8a97a] hover:text-[#f0c491] text-sm font-semibold transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#b47b3b] rounded-lg flex items-center justify-center">
            <Briefcase size={15} className="text-white" />
          </div>
          <span className="font-bold text-[#f6e6d2] text-sm">ZorHire</span>
        </div>

        <button
          onClick={() => navigate("/login")}
          className="flex items-center gap-1.5 text-sm font-bold text-white bg-[#b47b3b] hover:bg-[#9b5c27] px-4 py-2 rounded-xl transition-all"
        >
          <LogIn size={14} />
          Log In
        </button>
      </nav>

      {/* Pricing content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-24">
              <Loader2 size={28} className="animate-spin text-[#b47b3b]" />
            </div>
          }
        >
          <PricingCards publicMode />
        </Suspense>

        <p className="text-center text-xs text-[#9b8064] mt-10 font-medium">
          After subscribing, log in with your ZorTech-provided credentials to access the platform.
        </p>
      </div>
    </div>
  );
}
