import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Globe,
  Link2,
  LockKeyhole,
  Mail,
  Rocket,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAppSelector } from "../hooks/useAppSelector";
import { selectCurrentUser } from "../store/slices/authSlice";
import { selectSubscription } from "../store/slices/subscriptionSlice";
import { useGetOnboardingStatusQuery } from "../store/api/adminApi";
import { Button, buttonClasses } from "../components/ui";

import type { OnboardingStatus } from "../store/api/adminApi";

// ─── Step definitions ─────────────────────────────────────────────────────────
// Each step maps to one flag from GET /onboarding/status. "Go live" has no flag of
// its own: it is done once every other step is. `path` deep-links to the exact
// screen; `hint` says what to click there when the page can't open it by URL.

type FlagKey = "profile_complete" | "team_invited" | "channel_connected" | "first_job_posted" | "pipeline_created";

interface Step {
  key: FlagKey | "go_live";
  num: number;
  title: string;
  description: string;
  hint: string;
  action: string;
  time: string;
  icon: LucideIcon;
  path: string;
}

const STEPS: Step[] = [
  {
    key: "profile_complete",
    num: 1,
    title: "Complete your profile",
    description: "Add your name and details so your team and vendors know who they're working with.",
    hint: "Fill in your full name on the Profile page and click Save.",
    action: "Open profile",
    time: "3 mins",
    icon: Building2,
    path: "/profile",
  },
  {
    key: "team_invited",
    num: 2,
    title: "Invite your hiring team",
    description: "Add recruiters, account managers, and admins to collaborate.",
    hint: "On the Users page, click \u201cInvite user\u201d and enter their email and role.",
    action: "Invite a teammate",
    time: "3 mins",
    icon: Users,
    path: "/admin",
  },
  {
    key: "channel_connected",
    num: 3,
    title: "Connect your email",
    description: "Link your mailbox so job and candidate emails go out from your own address.",
    hint: "Enter your SMTP details and save. You'll come back here once it's connected.",
    action: "Connect email",
    time: "8 mins",
    icon: Link2,
    path: "/settings/email?returnTo=%2Fonboarding",
  },
  {
    key: "first_job_posted",
    num: 4,
    title: "Post your first job",
    description: "Create your first job opening to start receiving candidates from your vendors.",
    hint: "Fill in the job form (or paste the JD) and save it.",
    action: "Create a job",
    time: "7 mins",
    icon: Briefcase,
    path: "/jobs/new",
  },
  {
    key: "pipeline_created",
    num: 5,
    title: "Build your hiring pipeline",
    description: "Set up stages from sourcing to offer acceptance for your workflow.",
    hint: "On the Jobs page, click \u201cPipeline\u201d and pick your job to open its stages.",
    action: "Open jobs",
    time: "10 mins",
    icon: Workflow,
    path: "/jobs",
  },
  {
    key: "go_live",
    num: 6,
    title: "Go live",
    description: "Review your setup, share jobs with your vendors and start hiring.",
    hint: "Finish the steps above and your dashboard is ready.",
    action: "Go to dashboard",
    time: "2 mins",
    icon: Rocket,
    path: "/",
  },
];

function isStepDone(step: Step, status: OnboardingStatus | undefined): boolean {
  if (!status) return false;
  if (step.key === "go_live") return STEPS.every((s) => s.key === "go_live" || Boolean(status[s.key]));
  return Boolean(status[step.key]);
}

const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Bot,
    title: "AI Resume Screening",
    description: "Automatically rank and shortlist candidates using Gemini AI matching.",
  },
  {
    icon: CalendarDays,
    title: "Interview Scheduling",
    description: "Schedule interviews with calendar links and automated reminders.",
  },
  {
    icon: BarChart3,
    title: "Hiring Analytics",
    description: "Track pipeline velocity, SLA adherence, and team performance.",
  },
  {
    icon: Mail,
    title: "Candidate Communications",
    description: "Send templated emails at scale from your own SMTP mailbox.",
  },
  {
    icon: Globe,
    title: "Branded Career Page",
    description: "Publish an employer-branded job board with your company identity.",
  },
  {
    icon: LockKeyhole,
    title: "Role-Based Permissions",
    description: "Control exactly what recruiters, managers, and vendors can see.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const user = useAppSelector(selectCurrentUser);
  const subscription = useAppSelector(selectSubscription);
  const navigate = useNavigate();
  const [animating, setAnimating] = useState(false);

  const { data: status, isLoading: loading, isError } = useGetOnboardingStatusQuery();

  // Animate progress bar after data loads
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setAnimating(true), 500);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const doneFlags = STEPS.map((step) => isStepDone(step, status));
  const completedSteps = doneFlags.filter(Boolean).length;
  const percent = Math.round((completedSteps / STEPS.length) * 100);
  const pct = animating ? percent : 0;
  // First unfinished step; null when everything is done or the status isn't known.
  const nextStep = status ? (STEPS.find((_, i) => !doneFlags[i]) ?? null) : null;
  const allDone = !!status && nextStep === null;
  const goNext = () => navigate(nextStep ? nextStep.path : "/");
  const mainCtaLabel = nextStep && nextStep.key !== "go_live" ? `Continue setup: ${nextStep.title}` : "Go to dashboard";

  return (
    <div className="min-h-screen bg-surface text-ink">
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/brand/zortech-logo.png" alt="ZorTech" className="h-6 w-auto" />
            <span className="hidden border-l border-line pl-3 text-sm font-semibold text-navy-700 sm:inline">ZorHire</span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800 sm:inline">
              Welcome aboard
            </span>
            <Button size="sm" onClick={() => navigate("/")}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ────────────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-3xl px-4 pb-12 pt-14 text-center sm:px-6 sm:pt-20">
          {(subscription?.active || subscription?.isPlatformOwner) && (
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-success-600/20 bg-success-50 px-4 py-1.5 text-sm font-medium text-success-700">
              <CheckCircle2 size={16} aria-hidden="true" />
              Your subscription is active
            </div>
          )}
          <h1 className="mb-4 text-4xl font-semibold leading-tight tracking-tight text-navy-800 sm:text-5xl">
            Hire smarter. <span className="text-brand-700">Move faster.</span>
          </h1>
          <p className="mx-auto mb-9 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            {user ? `Welcome, ${user.full_name?.split(" ")[0] || "there"}. ` : ""}
            Complete your setup in ~35 minutes and start hiring the best talent — faster than ever.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={goNext} iconRight={<ArrowRight size={18} aria-hidden="true" />}>
              {mainCtaLabel}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => document.getElementById("setup-steps")?.scrollIntoView({ behavior: "smooth" })}
            >
              View setup steps
            </Button>
          </div>
        </section>

        {/* ── Progress ───────────────────────────────────────────────────────── */}
        <section id="setup-steps" className="mx-auto mb-16 max-w-3xl scroll-mt-20 px-4 sm:px-6">
          <div className="zh-card p-5 sm:p-7">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-ink">Setup Progress</h2>
              <span className="text-sm font-semibold text-navy-600">
                {loading ? "…" : isError ? "Progress unavailable" : `${completedSteps} / ${STEPS.length} steps complete`}
              </span>
            </div>

            <div
              className="mb-6 h-2 overflow-hidden rounded-full bg-surface-sunken"
              role="progressbar"
              aria-label="Setup progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={status ? percent : 0}
            >
              {/* Width is data-driven, so it stays an inline style. */}
              <div
                className="h-full rounded-full bg-brand-500 transition-[width] duration-1000 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>

            {nextStep && (
              <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-navy-600">
                    <nextStep.icon size={20} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-brand-800">
                      Next step · Step {nextStep.num} of {STEPS.length}
                    </p>
                    <h3 className="text-base font-semibold text-ink">{nextStep.title}</h3>
                    <p className="mt-0.5 text-sm text-ink-soft">{nextStep.hint}</p>
                  </div>
                  <Link to={nextStep.path} className={buttonClasses("primary", "md", "shrink-0")}>
                    {nextStep.action}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            )}
            {allDone && (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-success-600/20 bg-success-50 p-4 text-sm font-medium text-success-700">
                <CheckCircle2 size={18} aria-hidden="true" />
                Setup complete. You're ready to hire.
              </div>
            )}

            <ul className="grid gap-2 sm:grid-cols-2">
              {STEPS.map((step, i) => {
                const done = doneFlags[i];
                return (
                  <li key={step.num}>
                    <Link
                      to={step.path}
                      className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors hover:border-navy-300 hover:bg-navy-50 ${
                        done ? "border-success-600/20 bg-success-50 font-medium text-success-700" : "border-line text-ink-soft"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          done ? "bg-success-600 text-white" : "border-2 border-line-strong"
                        }`}
                      >
                        {done && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                      </span>
                      <span>
                        {step.title}
                        {done && <span className="sr-only"> (done)</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ── Step cards ────────────────────────────────────────────────────────── */}
        <section className="mx-auto mb-20 max-w-6xl px-4 sm:px-6">
          <h2 className="mb-8 text-center text-2xl font-semibold text-navy-800 sm:text-3xl">Your onboarding roadmap</h2>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, i) => {
              const done = doneFlags[i];
              const isNext = nextStep?.num === step.num;
              const Icon = step.icon;
              return (
                <li key={step.num}>
                  <Link
                    to={step.path}
                    className={`zh-card relative block h-full p-5 transition hover:-translate-y-0.5 hover:border-navy-300 hover:shadow-pop sm:p-6 ${
                      done ? "border-success-600/30" : isNext ? "border-brand-300 ring-1 ring-brand-200" : ""
                    }`}
                  >
                    {done && (
                      <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-success-600 text-white">
                        <Check size={14} strokeWidth={3} aria-hidden="true" />
                        <span className="sr-only">Done</span>
                      </span>
                    )}
                    <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="mb-1.5 block text-xs font-semibold text-brand-700">
                      Step {step.num}
                      {isNext && " · Next"}
                    </span>
                    <h3 className="mb-2 text-base font-semibold leading-snug text-ink">{step.title}</h3>
                    <p className="mb-4 text-sm leading-relaxed text-muted">{step.description}</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-1 text-xs text-ink-soft">
                      <Clock size={12} aria-hidden="true" />
                      {step.time}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Feature showcase ──────────────────────────────────────────────────── */}
        <section className="mx-auto mb-20 max-w-6xl px-4 sm:px-6">
          <h2 className="mb-8 text-center text-2xl font-semibold text-navy-800 sm:text-3xl">
            Everything you need to hire smarter
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="zh-card p-5 sm:p-6">
                  <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h3 className="mb-2 text-base font-semibold text-ink">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{f.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── CTA band ──────────────────────────────────────────────────────────── */}
        <section className="mx-auto mb-20 max-w-3xl px-4 sm:px-6">
          <div className="rounded-2xl bg-navy-800 px-6 py-10 text-center sm:px-10 sm:py-12">
            <h2 className="mb-3 text-2xl font-semibold text-white sm:text-3xl">Ready to build your dream team?</h2>
            <p className="mx-auto mb-7 max-w-md text-base leading-relaxed text-navy-100">
              Complete your setup in under 35 minutes and post your first job today.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button variant="accent" size="lg" onClick={goNext} iconRight={<ArrowRight size={18} aria-hidden="true" />}>
                {mainCtaLabel}
              </Button>
              <a
                href="mailto:tech@zortechs.in"
                className={buttonClasses("ghost", "lg", "border border-white/30 text-white hover:bg-white/10 hover:text-white")}
              >
                Book onboarding call
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ── Support bar ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-line bg-white px-4 py-7 sm:px-6">
        <div className="mx-auto flex max-w-6xl justify-center">
          <a href="mailto:tech@zortechs.in" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
            <Mail size={14} aria-hidden="true" />
            Need help? tech@zortechs.in
          </a>
        </div>
      </footer>
    </div>
  );
}
