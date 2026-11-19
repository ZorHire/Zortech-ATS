import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { buttonClasses, LoadingBlock } from "../components/ui";

const PricingCards = lazy(
  () => import("../components/subscription/PricingCards"),
);

export default function PublicPricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      {/* Top navbar */}
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2 text-sm text-muted hover:text-ink" aria-label="Back to ZorHire home">
            <ArrowLeft size={16} aria-hidden="true" className="shrink-0" />
            <img src="/brand/zortech-logo.png" alt="" className="h-6 w-auto" />
            <span className="hidden border-l border-line pl-2 font-semibold text-navy-700 sm:inline">ZorHire</span>
          </Link>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link to="/login" className="rounded-lg px-2 py-2 text-sm font-semibold text-navy-600 hover:text-navy-800 sm:px-3">
              Sign in
            </Link>
            <Link to="/book-demo" className={buttonClasses("primary", "md", "px-3 sm:px-4")}>
              Book a demo
            </Link>
          </div>
        </div>
      </header>

      {/* Pricing content */}
      <main className="flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
        <Suspense fallback={<LoadingBlock label="Loading plans…" />}>
          <PricingCards publicMode />
        </Suspense>

        <p className="mt-10 text-center text-sm text-muted">
          After subscribing, log in with your ZorTech-provided credentials to access the platform.
        </p>
      </main>
    </div>
  );
}
