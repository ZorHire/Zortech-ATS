import { useNavigate } from "react-router-dom";
import { ArrowRight, Users, BarChart3, ShieldCheck, Zap } from "lucide-react";
import { Button } from "../components/ui";

export default function SubscribePage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Left panel */}
      <div className="hidden flex-col justify-center bg-navy-800 px-16 py-12 lg:flex lg:flex-1">
        <div className="max-w-lg">
          <div className="mb-12">
            <img src="/brand/zortech-logo-white.png" alt="ZorTech" className="h-8 w-auto" />
            <p className="mt-2 text-sm font-medium text-navy-200">ZorHire · Enterprise ATS Platform</p>
          </div>

          <h2 className="mb-5 text-4xl font-semibold leading-tight text-white">
            Hire smarter,
            <br />
            <span className="text-brand-400">grow faster.</span>
          </h2>
          <p className="mb-10 text-lg leading-relaxed text-navy-100">
            ZorHire gives staffing agencies and HR teams a unified platform to
            source, screen, and place candidates — with AI-powered pipelines
            and real-time analytics built in.
          </p>

          <ul className="grid grid-cols-2 gap-4">
            {[
              { icon: Users, label: "Team Collaboration", sub: "role-based access" },
              { icon: BarChart3, label: "Real-time Analytics", sub: "live dashboards" },
              { icon: ShieldCheck, label: "Enterprise Security", sub: "invite-only access" },
              { icon: Zap, label: "AI Screening", sub: "resume parsing and matching" },
            ].map((item) => (
              <li key={item.label} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <item.icon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-400" />
                <div>
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="mt-0.5 text-xs text-navy-100">{item.sub}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center bg-white px-4 py-12 sm:px-6 lg:max-w-md">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/brand/zortech-logo.png" alt="ZorTech" className="h-6 w-auto" />
            <span className="border-l border-line pl-3 text-sm font-semibold text-navy-700">ZorHire</span>
          </div>

          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Zap size={24} aria-hidden="true" />
          </div>

          <h1 className="mb-2 text-2xl font-semibold text-navy-800">Start your journey</h1>
          <p className="mb-8 text-sm leading-relaxed text-muted">
            Book a short demo with our team. If ZorHire is a fit, we set up
            your company workspace and send your team their logins.
          </p>

          <Button
            size="lg"
            fullWidth
            className="group mb-3"
            onClick={() => navigate("/book-demo")}
            iconRight={<ArrowRight size={18} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />}
          >
            Book a demo
          </Button>

          <Button variant="secondary" size="lg" fullWidth className="mb-5" onClick={() => navigate("/pricing")}>
            View plans &amp; pricing
          </Button>

          <p className="text-center text-sm text-muted">
            Already have a ZorHire login?{" "}
            <button type="button" onClick={() => navigate("/login")} className="font-semibold text-navy-600 hover:underline">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
