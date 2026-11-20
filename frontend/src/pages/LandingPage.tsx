import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileText,
  LockKeyhole,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { buttonClasses } from "../components/ui";

const features = [
  {
    icon: Workflow,
    title: "Recruitment Pipeline",
    description:
      "Move candidates through every stage of your recruitment workflow with complete visibility.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description:
      "Keep recruiters, account managers and vendors working from one centralized workspace.",
  },
  {
    icon: FileText,
    title: "Smart Resume Management",
    description:
      "Organize candidate profiles and resumes so your team can find the right talent faster.",
  },
  {
    icon: Search,
    title: "Powerful Candidate Search",
    description:
      "Find the right candidates quickly with structured search across your recruitment database.",
  },
  {
    icon: Zap,
    title: "Faster Hiring Operations",
    description:
      "Reduce manual work and keep your recruitment operation moving from sourcing to placement.",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise Security",
    description:
      "Role-based access and tenant isolation keep your organization's recruitment data protected.",
  },
];

const workflow = [
  { number: "01", title: "Source", description: "Bring candidates into your recruitment workspace." },
  { number: "02", title: "Screen", description: "Review profiles and identify the strongest candidates." },
  { number: "03", title: "Pipeline", description: "Move candidates through your recruitment stages." },
  { number: "04", title: "Collaborate", description: "Keep your team, clients and vendors aligned." },
  { number: "05", title: "Place", description: "Turn the right candidate into a successful placement." },
];

// Widths for the decorative pipeline bars in the product preview.
const PREVIEW_BARS = ["w-[75%]", "w-[58%]", "w-[87%]", "w-[43%]", "w-[68%]"];

const NAV_LINKS = [
  { href: "#features", label: "Platform" },
  { href: "#workflow", label: "Workflow" },
  { href: "#security", label: "Security" },
];

const eyebrow = "mb-3 text-sm font-semibold text-brand-700";

export default function LandingPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const goToLogin = () => {
    navigate("/login");
  };

  // New client companies are onboarded after a demo (no self-signup).
  const goToDemo = () => {
    navigate("/book-demo");
  };

  // Close the phone menu on Escape or a click outside it.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-surface text-ink">
      {/* NAVIGATION */}
      <header ref={menuRef} className="fixed inset-x-0 top-0 z-50 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex min-w-0 items-center gap-3"
            aria-label="ZorHire home"
          >
            <img src="/brand/zortech-logo.png" alt="" className="h-6 w-auto sm:h-7" />
            <span className="hidden border-l border-line pl-3 text-left sm:block">
              <span className="block text-sm font-semibold leading-tight text-navy-700">ZorHire</span>
              <span className="block text-xs leading-tight text-muted">Enterprise ATS</span>
            </span>
          </button>

          {/* Desktop navigation */}
          <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-muted transition hover:text-ink">
                {l.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => navigate("/pricing")}
              className="text-sm text-muted transition hover:text-ink"
            >
              Pricing
            </button>
          </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            {/* Existing customers */}
            <button
              type="button"
              onClick={goToLogin}
              className="whitespace-nowrap rounded-lg px-2 py-2 text-sm font-semibold text-navy-700 transition hover:text-navy-900 sm:px-3"
            >
              Sign in
            </button>

            {/* Prospects */}
            <button type="button" onClick={goToDemo} className={buttonClasses("primary", "md", "group px-3 sm:px-4")}>
              Book a demo
              <ArrowRight size={15} aria-hidden="true" className="hidden transition-transform group-hover:translate-x-0.5 sm:block" />
            </button>

            {/* Phone menu */}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-sunken md:hidden"
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav id="landing-mobile-menu" aria-label="Main" className="border-t border-line bg-white px-4 py-2 shadow-pop md:hidden">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-3 text-sm font-medium text-ink hover:bg-surface"
              >
                {l.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                navigate("/pricing");
              }}
              className="block w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-ink hover:bg-surface"
            >
              Pricing
            </button>
          </nav>
        )}
      </header>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden bg-gradient-to-b from-white to-surface pt-16">
          <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pb-28 lg:pt-28">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-800">
                <Sparkles size={14} aria-hidden="true" />
                Enterprise Recruitment Platform
              </div>

              <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-navy-800 sm:text-6xl lg:text-7xl">
                Recruitment,
                <span className="block text-brand-700">refined.</span>
              </h1>

              <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
                ZorHire gives modern recruitment teams one powerful workspace to
                manage candidates, jobs, clients, vendors and the entire hiring
                pipeline.
              </p>

              {/* CTA */}
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button type="button" onClick={goToDemo} className={buttonClasses("primary", "lg", "group w-full px-7 sm:w-auto sm:min-w-[190px]")}>
                  Book a demo
                  <ArrowRight size={17} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
                </button>

                <a href="#features" className={buttonClasses("secondary", "lg", "group w-full px-7 sm:w-auto sm:min-w-[170px]")}>
                  Explore platform
                  <ChevronRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                </a>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted">
                <LockKeyhole size={14} aria-hidden="true" />
                Authorized access only
              </div>
            </div>

            {/* PRODUCT PREVIEW (decorative) */}
            <div className="relative mx-auto mt-16 max-w-6xl lg:mt-20" aria-hidden="true">
              <div className="relative overflow-hidden rounded-xl border border-line bg-white shadow-pop">
                {/* Browser top bar */}
                <div className="flex h-10 items-center border-b border-line bg-surface px-4">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
                    <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
                    <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
                  </div>
                  <div className="mx-auto hidden h-5 w-[42%] rounded-md border border-line bg-white sm:block" />
                  <div className="w-10" />
                </div>

                {/* Fake application: sidebar only from sm up so phones don't overflow */}
                <div className="grid min-h-[360px] grid-cols-1 sm:min-h-[430px] sm:grid-cols-[150px_minmax(0,1fr)] lg:grid-cols-[190px_minmax(0,1fr)]">
                  <div className="hidden bg-navy-800 p-5 sm:block">
                    <img src="/brand/zortech-logo-white.png" alt="" className="mb-8 h-4 w-auto opacity-90" />
                    <div className="space-y-2">
                      {[0, 1, 2, 3, 4, 5].map((item) => (
                        <div
                          key={item}
                          className={`flex h-9 items-center gap-3 rounded-lg px-3 ${item === 0 ? "bg-white/10" : ""}`}
                        >
                          <div className={`h-3.5 w-3.5 rounded ${item === 0 ? "bg-brand-500" : "bg-white/20"}`} />
                          <div className={`h-2.5 rounded ${item === 0 ? "w-16 bg-white/60" : "w-14 bg-white/15"}`} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-8 border-t border-white/10 pt-6">
                      <div className="mb-3 h-2 w-16 rounded bg-white/15" />
                      <div className="space-y-2">
                        <div className="h-8 rounded-lg bg-white/5" />
                        <div className="h-8 rounded-lg bg-white/5" />
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 bg-surface p-4 sm:p-6 lg:p-8">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="h-5 w-32 max-w-full rounded bg-navy-100 sm:w-40" />
                        <div className="mt-3 h-3 w-48 max-w-full rounded bg-line sm:w-60" />
                      </div>
                      <div className="hidden h-9 w-28 shrink-0 rounded-lg bg-navy-600 sm:block" />
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-2 sm:mt-8 sm:gap-3">
                      {[
                        ["Active Jobs", "128"],
                        ["Candidates", "4,826"],
                        ["Placements", "342"],
                      ].map(([label, value], index) => (
                        <div key={label} className="min-w-0 rounded-lg border border-line bg-white p-3 sm:p-4">
                          <div className="h-2 w-12 max-w-full rounded bg-line sm:w-20" />
                          <div className={`mt-3 truncate text-base font-semibold sm:text-xl ${index === 0 ? "text-brand-700" : "text-navy-800"}`}>
                            {value}
                          </div>
                          <div className="mt-1 truncate text-xs text-muted">{label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                      <div className="rounded-lg border border-line bg-white p-4 sm:p-5">
                        <div className="flex items-center justify-between">
                          <div className="h-3 w-28 rounded bg-navy-100" />
                          <div className="h-3 w-14 rounded bg-line" />
                        </div>
                        <div className="mt-6 space-y-3">
                          {PREVIEW_BARS.map((w, index) => (
                            <div key={index} className="flex items-center gap-3">
                              <div className="h-2 w-12 shrink-0 rounded bg-line sm:w-20" />
                              <div className="h-2 flex-1 rounded-full bg-surface-sunken">
                                <div className={`h-full rounded-full bg-navy-400 ${w}`} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="hidden rounded-lg border border-line bg-white p-5 sm:block">
                        <div className="h-3 w-24 rounded bg-navy-100" />
                        <div className="mt-5 space-y-4">
                          {[1, 2, 3, 4].map((item) => (
                            <div key={item} className="flex items-center gap-3">
                              <div className="h-7 w-7 shrink-0 rounded-full bg-brand-100" />
                              <div className="min-w-0 flex-1">
                                <div className="h-2 w-20 max-w-full rounded bg-line" />
                                <div className="mt-1.5 h-1.5 w-28 max-w-full rounded bg-surface-sunken" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <section className="border-y border-line bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-5 text-center md:flex-row md:text-left">
              <p className="text-sm font-medium text-navy-700">Built for modern recruitment organizations</p>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted">
                <span>Multi-Tenant</span>
                <span>Role-Based Access</span>
                <span>Candidate Management</span>
                <span>Vendor Collaboration</span>
                <span>AI-Assisted</span>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="scroll-mt-16 bg-surface py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <div className={eyebrow}>The platform</div>
              <h2 className="text-3xl font-semibold tracking-tight text-navy-800 sm:text-5xl">
                Everything your recruitment operation needs.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted">
                A single workspace designed to give recruitment teams the
                visibility, control and speed they need to perform.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="zh-card p-6 transition hover:border-line-strong sm:p-7">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-navy-800">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* WORKFLOW */}
        <section id="workflow" className="scroll-mt-16 border-y border-line bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16">
              <div>
                <div className={eyebrow}>Your workflow</div>
                <h2 className="text-3xl font-semibold tracking-tight text-navy-800 sm:text-5xl">
                  From candidate to placement.
                </h2>
                <p className="mt-6 max-w-lg text-base leading-7 text-muted">
                  Keep every stage of your recruitment operation connected
                  inside one structured workflow.
                </p>
                <button
                  type="button"
                  onClick={goToLogin}
                  className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold text-navy-600 transition hover:text-navy-800"
                >
                  Access your workspace
                  <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
                </button>
              </div>

              <div className="relative">
                <div className="absolute bottom-7 left-9 top-7 sm:left-10 w-px bg-line-strong" aria-hidden="true" />
                <ol className="space-y-3">
                  {workflow.map((step, index) => (
                    <li
                      key={step.number}
                      className="relative flex items-center gap-4 rounded-xl border border-line bg-white p-4 sm:gap-5 sm:p-5"
                    >
                      <div
                        className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${
                          index === 0
                            ? "border-brand-300 bg-brand-50 text-brand-800"
                            : "border-line bg-surface text-muted"
                        }`}
                      >
                        {step.number}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-navy-800">{step.title}</h3>
                        <p className="mt-1 text-sm text-muted">{step.description}</p>
                      </div>
                      <Check size={16} aria-hidden="true" className="ml-auto shrink-0 text-success-600" />
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* SECURITY */}
        <section id="security" className="scroll-mt-16 bg-surface py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-2xl bg-navy-800 p-6 sm:p-12 lg:p-16">
              <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12">
                <div className="max-w-2xl">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/10 text-brand-400">
                    <ShieldCheck size={22} strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <h2 className="mt-7 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
                    Your recruitment data stays under your control.
                  </h2>
                  <p className="mt-5 text-base leading-7 text-navy-100">
                    ZorHire is built around secure authentication, tenant-aware
                    architecture and role-based access so every member of your
                    organization sees what they are supposed to see.
                  </p>
                </div>

                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-[330px]">
                  {[
                    "Tenant Isolation",
                    "Role-Based Access",
                    "Secure Authentication",
                    "Protected Data",
                    "Controlled Access",
                    "Audit Ready",
                  ].map((item) => (
                    <li key={item} className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                      <Check size={14} aria-hidden="true" className="mx-auto mb-2 text-brand-400" />
                      <span className="text-xs leading-4 text-navy-100">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="border-t border-line bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-brand-500" aria-hidden="true" />
            <h2 className="text-3xl font-semibold tracking-tight text-navy-800 sm:text-5xl">
              See ZorHire on your own hiring.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted">
              Book a 30-minute demo. We'll walk through your roles, vendors and
              pipeline, and set up your workspace if it's a fit.
            </p>
            <button type="button" onClick={goToDemo} className={buttonClasses("primary", "lg", "group mt-9 px-8")}>
              Book a demo
              <ArrowRight size={17} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
            </button>
            <p className="mt-5 text-sm text-muted">
              Already using ZorHire?{" "}
              <button type="button" onClick={goToLogin} className="font-semibold text-navy-600 underline-offset-2 hover:underline">
                Sign in
              </button>
            </p>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/brand/zortech-logo.png" alt="ZorTech" className="h-5 w-auto" />
            <span className="border-l border-line pl-3 text-sm font-semibold text-navy-700">ZorHire</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-muted">
            <a href="#features" className="transition hover:text-ink">
              Platform
            </a>
            <a href="#security" className="transition hover:text-ink">
              Security
            </a>
            <button type="button" onClick={goToLogin} className="transition hover:text-ink">
              Sign in
            </button>
          </div>

          <div className="text-sm text-muted">© {new Date().getFullYear()} ZorHire by ZorTech</div>
        </div>
      </footer>
    </div>
  );
}
