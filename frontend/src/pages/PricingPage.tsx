import { lazy, Suspense } from "react";
import Header from "../components/layout/Header";
import { Loader2 } from "lucide-react";
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
      <Header
        title="Subscription"
        subtitle="Manage your ZorHire plan"
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
        <Suspense fallback={<CardsSkeleton />}>
          <PricingCards onSubscribed={handleSubscribed} />
        </Suspense>
      </div>
    </div>
  );
}
