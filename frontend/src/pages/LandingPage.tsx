import {
  ArrowRight,
  Briefcase,
  Check,
  ChevronRight,
  FileText,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  {
    number: "01",
    title: "Source",
    description: "Bring candidates into your recruitment workspace.",
  },
  {
    number: "02",
    title: "Screen",
    description: "Review profiles and identify the strongest candidates.",
  },
  {
    number: "03",
    title: "Pipeline",
    description: "Move candidates through your recruitment stages.",
  },
  {
    number: "04",
    title: "Collaborate",
    description: "Keep your team, clients and vendors aligned.",
  },
  {
    number: "05",
    title: "Place",
    description: "Turn the right candidate into a successful placement.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  const goToLogin = () => {
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#F8EFE3] text-[#07101C] selection:bg-[#E5B83F]/30">
      {/* =========================================================
          NAVIGATION
      ========================================================= */}

      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#07101C]/[0.06] bg-[#F8EFE3]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-6 lg:px-8">
          {/* Logo */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="group flex items-center gap-3"
            aria-label="ZorHire home"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5B83F]/30 bg-[#E5B83F]/10 transition group-hover:border-[#E5B83F]/60 group-hover:bg-[#E5B83F]/15">
              <Briefcase
                size={19}
                className="text-[#E5B83F]"
                strokeWidth={1.8}
              />
            </div>

            <div className="text-left">
              <div className="text-lg font-semibold tracking-tight text-[#07101C]">
                Zor<span className="text-[#E5B83F]">Hire</span>
              </div>

              <div className="text-[9px] font-medium uppercase tracking-[0.22em] text-[#75695F]">
                Enterprise ATS
              </div>
            </div>
          </button>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-sm text-[#75695F] transition hover:text-[#07101C]"
            >
              Platform
            </a>

            <a
              href="#workflow"
              className="text-sm text-[#75695F] transition hover:text-[#07101C]"
            >
              Workflow
            </a>

            <a
              href="#security"
              className="text-sm text-[#75695F] transition hover:text-[#07101C]"
            >
              Security
            </a>
          </nav>

          {/* Login */}
          <button
            type="button"
            onClick={goToLogin}
            className="group inline-flex items-center gap-2 rounded-lg border border-[#E5B83F]/40 bg-[#E5B83F]/5 px-5 py-2.5 text-sm font-semibold text-[#E8C75B] transition-all hover:border-[#E5B83F]/70 hover:bg-[#E5B83F]/10 hover:text-[#F3D477]"
          >
            Login
            <ArrowRight
              size={15}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>
        </div>
      </header>

      {/* =========================================================
          HERO
      ========================================================= */}

      <main>
        <section className="relative overflow-hidden pt-[76px]">
          {/* Ambient gold glow */}
          <div className="pointer-events-none absolute left-1/2 top-[-260px] h-[650px] w-[900px] -translate-x-1/2 rounded-full bg-[#E5B83F]/[0.08] blur-[140px]" />

          {/* Secondary glow */}
          <div className="pointer-events-none absolute right-[-200px] top-[350px] h-[400px] w-[400px] rounded-full bg-[#E5B83F]/[0.035] blur-[120px]" />

          {/* Subtle grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(229,184,63,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(229,184,63,0.8) 1px, transparent 1px)",
              backgroundSize: "70px 70px",
            }}
          />

          <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-24 lg:px-8 lg:pb-32 lg:pt-32">
            {/* Hero copy */}
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#E5B83F]/20 bg-[#E5B83F]/[0.06] px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[#E5B83F]">
                <Sparkles size={13} />
                Enterprise Recruitment Platform
              </div>

              <h1 className="text-5xl font-semibold leading-[1.05] tracking-[-0.035em] text-[#07101C] sm:text-6xl lg:text-7xl">
                Recruitment,
                <span className="block">
                  <span className="bg-gradient-to-r from-[#C79F2E] via-[#F3D477] to-[#C79F2E] bg-clip-text text-transparent">
                    refined.
                  </span>
                </span>
              </h1>

              <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-[#75695F] sm:text-lg sm:leading-8">
                ZorHire gives modern recruitment teams one powerful workspace to
                manage candidates, jobs, clients, vendors and the entire hiring
                pipeline.
              </p>

              {/* CTA */}
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={goToLogin}
                  className="group inline-flex min-w-[190px] items-center justify-center gap-2 rounded-xl bg-[#E5B83F] px-7 py-3.5 text-sm font-bold text-[#080706] shadow-[0_0_40px_rgba(229,184,63,0.15)] transition-all hover:bg-[#F0C95A] hover:shadow-[0_0_50px_rgba(229,184,63,0.22)]"
                >
                  Login to ZorHire
                  <ArrowRight
                    size={17}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </button>

                <a
                  href="#features"
                  className="group inline-flex min-w-[170px] items-center justify-center gap-2 rounded-xl border border-[#07101C]/10 bg-[#07101C]/[0.025] px-7 py-3.5 text-sm font-medium text-[#07101C]/70 transition hover:border-[#07101C]/20 hover:bg-[#07101C]/[0.05] hover:text-[#07101C]"
                >
                  Explore platform
                  <ChevronRight
                    size={16}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </a>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[#75695F]">
                <LockKeyhole size={13} />
                Authorized access only
              </div>
            </div>

            {/* =====================================================
                PRODUCT PREVIEW
            ===================================================== */}

            <div className="relative mx-auto mt-20 max-w-6xl lg:mt-24">
              {/* Glow behind dashboard */}
              <div className="pointer-events-none absolute inset-x-10 bottom-[-40px] top-10 rounded-[32px] bg-[#E5B83F]/10 blur-[80px]" />

              <div className="relative overflow-hidden rounded-2xl border border-[#07101C]/10 bg-[#FFFFFF] shadow-2xl shadow-[#24180F]/20">
                {/* Browser top bar */}
                <div className="flex h-12 items-center border-b border-[#07101C]/[0.07] bg-[#FFF8F1] px-5">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#07101C]/10" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#07101C]/10" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#07101C]/10" />
                  </div>

                  <div className="mx-auto hidden h-6 w-[42%] rounded-md border border-[#07101C]/[0.05] bg-[#07101C]/[0.025] sm:block" />

                  <div className="w-12" />
                </div>

                {/* Fake application */}
                <div className="grid min-h-[430px] grid-cols-[190px_1fr]">
                  {/* Sidebar */}
                  <div className="border-r border-[#07101C]/[0.07] bg-[#24180F] p-5">
                    <div className="mb-8 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E5B83F]/10">
                        <Briefcase
                          size={14}
                          className="text-[#E5B83F]"
                        />
                      </div>

                      <div className="h-3 w-16 rounded bg-[#FFF8F1]/20" />
                    </div>

                    <div className="space-y-2">
                      {[0, 1, 2, 3, 4, 5].map((item) => (
                        <div
                          key={item}
                          className={`flex h-9 items-center gap-3 rounded-lg px-3 ${
                            item === 0
                              ? "border border-[#E5B83F]/10 bg-[#E5B83F]/[0.08]"
                              : ""
                          }`}
                        >
                          <div
                            className={`h-3.5 w-3.5 rounded ${
                              item === 0 ? "bg-[#E5B83F]/70" : "bg-[#FFF8F1]/[0.16]"
                            }`}
                          />

                          <div
                            className={`h-2.5 rounded ${
                              item === 0
                                ? "w-20 bg-[#E5B83F]/30"
                                : "w-16 bg-[#FFF8F1]/[0.14]"
                            }`}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 border-t border-[#07101C]/[0.06] pt-6">
                      <div className="mb-3 h-2 w-16 rounded bg-[#FFF8F1]/[0.16]" />

                      <div className="space-y-2">
                        <div className="h-8 rounded-lg bg-[#FFF8F1]/[0.07]" />
                        <div className="h-8 rounded-lg bg-[#FFF8F1]/[0.07]" />
                      </div>
                    </div>
                  </div>

                  {/* Main dashboard */}
                  <div className="bg-[#F8EFE3] p-6 lg:p-8">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="h-6 w-40 rounded bg-[#07101C]/10" />
                        <div className="mt-3 h-3 w-60 rounded bg-[#07101C]/[0.06]" />
                      </div>

                      <div className="hidden h-9 w-28 rounded-lg bg-[#E5B83F]/80 sm:block" />
                    </div>

                    {/* Stats */}
                    <div className="mt-8 grid gap-3 sm:grid-cols-3">
                      {[
                        ["Active Jobs", "128"],
                        ["Candidates", "4,826"],
                        ["Placements", "342"],
                      ].map(([label, value], index) => (
                        <div
                          key={label}
                          className="rounded-xl border border-[#07101C]/[0.07] bg-[#07101C]/[0.02] p-4"
                        >
                          <div className="h-2.5 w-20 rounded bg-[#07101C]/[0.07]" />

                          <div
                            className={`mt-3 text-xl font-semibold ${
                              index === 0 ? "text-[#E5B83F]" : "text-[#07101C]/80"
                            }`}
                          >
                            {value}
                          </div>

                          <div className="mt-1 text-[9px] text-[#75695F]">
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Dashboard content */}
                    <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                      {/* Pipeline */}
                      <div className="rounded-xl border border-[#07101C]/[0.07] bg-[#07101C]/[0.018] p-5">
                        <div className="flex items-center justify-between">
                          <div className="h-3 w-28 rounded bg-[#07101C]/[0.08]" />
                          <div className="h-3 w-14 rounded bg-[#07101C]/[0.05]" />
                        </div>

                        <div className="mt-6 space-y-3">
                          {[75, 58, 87, 43, 68].map((width, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-3"
                            >
                              <div className="h-2 w-20 rounded bg-[#07101C]/[0.05]" />

                              <div className="h-2 flex-1 rounded-full bg-[#07101C]/[0.05]">
                                <div
                                  className="h-full rounded-full bg-[#E5B83F]/50"
                                  style={{ width: `${width}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Activity */}
                      <div className="rounded-xl border border-[#07101C]/[0.07] bg-[#07101C]/[0.018] p-5">
                        <div className="h-3 w-24 rounded bg-[#07101C]/[0.08]" />

                        <div className="mt-5 space-y-4">
                          {[1, 2, 3, 4].map((item) => (
                            <div key={item} className="flex items-center gap-3">
                              <div className="h-7 w-7 rounded-full bg-[#E5B83F]/10" />

                              <div className="flex-1">
                                <div className="h-2 w-20 rounded bg-[#07101C]/[0.07]" />
                                <div className="mt-1.5 h-1.5 w-28 rounded bg-[#07101C]/[0.04]" />
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

        {/* =========================================================
            TRUST STRIP
        ========================================================= */}

        <section className="border-y border-[#E7D9C8] bg-[#FFF8F1]">
          <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
              <p className="text-xs uppercase tracking-[0.18em] text-[#75695F]">
                Built for modern recruitment organizations
              </p>

              <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-[#75695F]">
                <span>Multi-Tenant</span>
                <span>Role-Based Access</span>
                <span>Candidate Management</span>
                <span>Vendor Collaboration</span>
                <span>AI-Assisted</span>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            FEATURES
        ========================================================= */}

        <section id="features" className="bg-[#F8EFE3] py-28 lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="max-w-2xl">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#E5B83F]">
                The platform
              </div>

              <h2 className="text-4xl font-semibold tracking-[-0.025em] text-[#07101C] sm:text-5xl">
                Everything your recruitment operation needs.
              </h2>

              <p className="mt-5 max-w-xl text-base leading-7 text-[#75695F]">
                A single workspace designed to give recruitment teams the
                visibility, control and speed they need to perform.
              </p>
            </div>

            <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-[#07101C]/[0.07] bg-[#07101C]/[0.07] sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.title}
                    className="group bg-[#F3E7D7] p-7 transition hover:bg-[#FFF8F1]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5B83F]/15 bg-[#E5B83F]/[0.06]">
                      <Icon
                        size={20}
                        className="text-[#E5B83F]"
                        strokeWidth={1.7}
                      />
                    </div>

                    <h3 className="mt-6 text-lg font-semibold text-[#07101C]">
                      {feature.title}
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-[#75695F]">
                      {feature.description}
                    </p>

                    <div className="mt-6 h-px w-8 bg-[#E5B83F]/40 transition-all group-hover:w-14" />
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =========================================================
            WORKFLOW
        ========================================================= */}

        <section
          id="workflow"
          className="border-y border-[#07101C]/[0.06] bg-[#F3E7D7] py-28 lg:py-32"
        >
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#E5B83F]">
                  Your workflow
                </div>

                <h2 className="text-4xl font-semibold tracking-[-0.025em] text-[#07101C] sm:text-5xl">
                  From candidate to placement.
                </h2>

                <p className="mt-6 max-w-lg text-base leading-7 text-[#75695F]">
                  Keep every stage of your recruitment operation connected
                  inside one structured workflow.
                </p>

                <button
                  type="button"
                  onClick={goToLogin}
                  className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#E5B83F] transition hover:text-[#F3D477]"
                >
                  Access your workspace
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </button>
              </div>

              <div className="relative">
                {/* Vertical gold line */}
                <div className="absolute bottom-7 left-[20px] top-7 w-px bg-gradient-to-b from-[#E5B83F]/50 via-[#E5B83F]/20 to-transparent" />

                <div className="space-y-3">
                  {workflow.map((step, index) => (
                    <div
                      key={step.number}
                      className="group relative flex items-center gap-5 rounded-2xl border border-[#07101C]/[0.06] bg-[#FFFFFF] p-5 transition hover:border-[#E5B83F]/20"
                    >
                      <div
                        className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xs font-bold ${
                          index === 0
                            ? "border-[#E5B83F]/40 bg-[#E5B83F]/10 text-[#E5B83F]"
                            : "border-[#07101C]/[0.08] bg-[#EDE1D2] text-[#75695F]"
                        }`}
                      >
                        {step.number}
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-[#07101C]">
                          {step.title}
                        </h3>

                        <p className="mt-1 text-sm text-[#75695F]">
                          {step.description}
                        </p>
                      </div>

                      <Check
                        size={16}
                        className="ml-auto text-[#07101C]/40 transition group-hover:text-[#E5B83F]/70"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            SECURITY
        ========================================================= */}

        <section id="security" className="bg-[#F8EFE3] py-28 lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl border border-[#E5B83F]/15 bg-[#24180F] p-8 sm:p-12 lg:p-16">
              <div className="pointer-events-none absolute right-[-120px] top-[-160px] h-[400px] w-[400px] rounded-full bg-[#E5B83F]/[0.06] blur-[100px]" />

              <div className="relative grid gap-12 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="max-w-2xl">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#E5B83F]/30 bg-[#E5B83F]/[0.10]">
                    <ShieldCheck
                      size={22}
                      className="text-[#E5B83F]"
                      strokeWidth={1.7}
                    />
                  </div>

                  <h2 className="mt-7 text-3xl font-semibold tracking-tight text-[#FFF8F1] sm:text-4xl">
                    Your recruitment data stays under your control.
                  </h2>

                  <p className="mt-5 text-base leading-7 text-[#FFF8F1]/70">
                    ZorHire is built around secure authentication, tenant-aware
                    architecture and role-based access so every member of your
                    organization sees what they are supposed to see.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-[330px]">
                  {[
                    "Tenant Isolation",
                    "Role-Based Access",
                    "Secure Authentication",
                    "Protected Data",
                    "Controlled Access",
                    "Audit Ready",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-xl border border-[#F5D878]/15 bg-[#FFF8F1]/[0.06] p-3 text-center"
                    >
                      <Check
                        size={14}
                        className="mx-auto mb-2 text-[#E5B83F]"
                      />

                      <span className="text-[10px] leading-4 text-[#FFF8F1]/70">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            FINAL CTA
        ========================================================= */}

        <section className="border-t border-[#07101C]/[0.06] bg-[#F3E7D7] py-28">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <div className="mx-auto mb-5 h-px w-12 bg-[#E5B83F]" />

            <h2 className="text-4xl font-semibold tracking-[-0.025em] text-[#07101C] sm:text-5xl">
              Your recruitment workspace is waiting.
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#75695F]">
              Sign in to your ZorHire workspace and continue managing your
              recruitment operation.
            </p>

            <button
              type="button"
              onClick={goToLogin}
              className="group mt-9 inline-flex items-center gap-2 rounded-xl bg-[#E5B83F] px-8 py-4 text-sm font-bold text-[#080706] shadow-[0_0_40px_rgba(229,184,63,0.12)] transition-all hover:bg-[#F0C95A] hover:shadow-[0_0_50px_rgba(229,184,63,0.2)]"
            >
              Login to ZorHire
              <ArrowRight
                size={17}
                className="transition-transform group-hover:translate-x-1"
              />
            </button>

            <p className="mt-5 text-xs text-[#75695F]">
              ZorHire access is restricted to authorized users.
            </p>
          </div>
        </section>
      </main>

      {/* =========================================================
          FOOTER
      ========================================================= */}

      <footer className="border-t border-[#07101C]/[0.06] bg-[#F8EFE3]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <div className="text-sm font-semibold text-[#07101C]">
              Zor<span className="text-[#E5B83F]">Hire</span>
            </div>

            <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-[#75695F]">
              Enterprise ATS Platform
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-[#75695F]">
            <a href="#features" className="transition hover:text-[#07101C]/70">
              Platform
            </a>

            <a href="#security" className="transition hover:text-[#07101C]/70">
              Security
            </a>

            <button
              type="button"
              onClick={goToLogin}
              className="transition hover:text-[#07101C]/70"
            >
              Login
            </button>
          </div>

          <div className="text-xs text-[#75695F]">
            © {new Date().getFullYear()} ZorHire
          </div>
        </div>
      </footer>
    </div>
  );
}
