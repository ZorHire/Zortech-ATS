import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingStatus {
  tenant_id: string;
  account_created: boolean;
  profile_complete: boolean;
  team_invited: boolean;
  pipeline_created: boolean;
  channel_connected: boolean;
  first_job_posted: boolean;
  completed_steps: number;
  total_steps: number;
  percent_complete: number;
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  {
    key: "account_created" as const,
    num: 1,
    title: "Set up company profile",
    description: "Add your brand, industry, and company details to personalise your ATS.",
    time: "5 mins",
    icon: "🏢",
    path: "/admin",
  },
  {
    key: "team_invited" as const,
    num: 2,
    title: "Invite your hiring team",
    description: "Add recruiters, account managers, and admins to collaborate.",
    time: "3 mins",
    icon: "👥",
    path: "/admin",
  },
  {
    key: "pipeline_created" as const,
    num: 3,
    title: "Build your hiring pipeline",
    description: "Set up stages from sourcing to offer acceptance for your workflow.",
    time: "10 mins",
    icon: "🔀",
    path: "/jobs",
  },
  {
    key: "channel_connected" as const,
    num: 4,
    title: "Connect your channels",
    description: "Link your email and job boards so candidates flow in automatically.",
    time: "8 mins",
    icon: "🔗",
    path: "/settings/email",
  },
  {
    key: "first_job_posted" as const,
    num: 5,
    title: "Post your first job",
    description: "Create and activate your first job opening to start receiving applications.",
    time: "7 mins",
    icon: "📋",
    path: "/jobs/new",
  },
  {
    key: "first_job_posted" as const,
    num: 6,
    title: "Go live",
    description: "Review your setup and flip the switch — your ATS is ready to hire.",
    time: "2 mins",
    icon: "🚀",
    path: "/jobs",
  },
];

const FEATURES = [
  {
    icon: "🤖",
    title: "AI Resume Screening",
    description: "Automatically rank and shortlist candidates using Gemini AI matching.",
  },
  {
    icon: "📅",
    title: "Interview Scheduling",
    description: "Schedule interviews with calendar links and automated reminders.",
  },
  {
    icon: "📊",
    title: "Hiring Analytics",
    description: "Track pipeline velocity, SLA adherence, and team performance.",
  },
  {
    icon: "✉️",
    title: "Candidate Communications",
    description: "Send templated emails at scale from your own SMTP mailbox.",
  },
  {
    icon: "🌐",
    title: "Branded Career Page",
    description: "Publish an employer-branded job board with your company identity.",
  },
  {
    icon: "🔐",
    title: "Role-Based Permissions",
    description: "Control exactly what recruiters, managers, and vendors can see.",
  },
];

// ─── Colour tokens ─────────────────────────────────────────────────────────────

const C = {
  navy: "#0D1B2A",
  blue: "#00E5FF",
  navyLight: "#162335",
  navyCard: "#1a2d44",
  text: "#c8d6e5",
  muted: "#7a9ab8",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [animating, setAnimating] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.request("/onboarding/status");
      setStatus(data);
    } catch {
      // silently ignore — page still renders without step data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Animate progress bar after mount
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setAnimating(true), 500);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const pct = animating ? (status?.percent_complete ?? 0) : 0;
  const completedSteps = status?.completed_steps ?? 0;

  function isStepDone(key: string, stepNum: number): boolean {
    if (!status) return false;
    if (key === "account_created") return true;
    if (stepNum === 6) return status.first_job_posted;
    return Boolean(status[key as keyof OnboardingStatus]);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.navy,
        color: C.text,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent 47px, rgba(0,229,255,0.04) 47px, rgba(0,229,255,0.04) 48px),
          repeating-linear-gradient(90deg, transparent, transparent 47px, rgba(0,229,255,0.04) 47px, rgba(0,229,255,0.04) 48px)
        `,
      }}
    >
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav
        style={{
          background: "rgba(13,27,42,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid rgba(0,229,255,0.12)`,
          padding: "0 40px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <span style={{ color: C.blue, fontWeight: 800, fontSize: 22, letterSpacing: -0.5 }}>
          ZorHire
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            style={{
              background: "rgba(0,229,255,0.12)",
              color: C.blue,
              border: `1px solid rgba(0,229,255,0.3)`,
              borderRadius: 999,
              padding: "4px 14px",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Welcome aboard
          </span>
          <button
            onClick={() => navigate("/")}
            style={{
              background: C.blue,
              color: C.navy,
              border: "none",
              borderRadius: 8,
              padding: "8px 20px",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Go to Dashboard
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "72px 24px 48px", textAlign: "center" }}>
        <div
          style={{
            display: "inline-block",
            background: "rgba(0,229,255,0.1)",
            border: `1px solid rgba(0,229,255,0.3)`,
            borderRadius: 999,
            padding: "6px 18px",
            fontSize: 13,
            color: C.blue,
            fontWeight: 600,
            marginBottom: 24,
          }}
        >
          ✅ Your subscription is active
        </div>
        <h1
          style={{
            margin: "0 0 16px",
            fontSize: "clamp(36px, 6vw, 56px)",
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: -1.5,
            lineHeight: 1.1,
          }}
        >
          Hire smarter.{" "}
          <span style={{ color: C.blue }}>Move faster.</span>
        </h1>
        <p style={{ margin: "0 auto 36px", maxWidth: 560, fontSize: 18, color: C.muted, lineHeight: 1.6 }}>
          {user ? `Welcome, ${user.full_name?.split(" ")[0] || "there"}. ` : ""}
          Complete your setup in ~35 minutes and start hiring the best talent — faster than ever.
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => navigate("/")}
            style={{
              background: C.blue,
              color: C.navy,
              border: "none",
              borderRadius: 10,
              padding: "14px 32px",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Launch ZorHire →
          </button>
          <button
            onClick={() => document.getElementById("setup-steps")?.scrollIntoView({ behavior: "smooth" })}
            style={{
              background: "transparent",
              color: C.text,
              border: `1px solid rgba(200,214,229,0.3)`,
              borderRadius: 10,
              padding: "14px 32px",
              fontWeight: 600,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            View setup steps
          </button>
        </div>
      </section>

      {/* ── Progress bar ──────────────────────────────────────────────────────── */}
      <section
        id="setup-steps"
        style={{
          maxWidth: 900,
          margin: "0 auto 64px",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            background: C.navyLight,
            border: `1px solid rgba(0,229,255,0.12)`,
            borderRadius: 16,
            padding: "28px 32px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>Setup Progress</span>
            <span style={{ color: C.blue, fontWeight: 700, fontSize: 15 }}>
              {loading ? "…" : `${completedSteps} / 6 steps complete`}
            </span>
          </div>

          {/* Bar */}
          <div style={{ background: "rgba(0,229,255,0.08)", borderRadius: 999, height: 8, marginBottom: 24, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${C.blue}, #00b8d9)`,
                borderRadius: 999,
                transition: "width 1s ease",
                boxShadow: `0 0 12px rgba(0,229,255,0.4)`,
              }}
            />
          </div>

          {/* Checklist */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 10,
            }}
          >
            {STEPS.map((step, i) => {
              const done = isStepDone(step.key, step.num);
              return (
                <button
                  key={i}
                  onClick={() => navigate(step.path)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: done ? "rgba(0,229,255,0.06)" : "transparent",
                    border: `1px solid ${done ? "rgba(0,229,255,0.2)" : "rgba(200,214,229,0.08)"}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: done ? "none" : `2px solid rgba(200,214,229,0.3)`,
                      background: done ? C.blue : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      flexShrink: 0,
                      color: C.navy,
                      fontWeight: 700,
                    }}
                  >
                    {done ? "✓" : ""}
                  </span>
                  <span style={{ fontSize: 13, color: done ? C.blue : C.text, fontWeight: done ? 600 : 400 }}>
                    {step.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Step cards ────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: "0 auto 80px", padding: "0 24px" }}>
        <h2 style={{ textAlign: "center", margin: "0 0 36px", fontSize: 28, fontWeight: 800, color: "#fff" }}>
          Your onboarding roadmap
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
          }}
        >
          {STEPS.map((step, i) => {
            const done = isStepDone(step.key, step.num);
            return (
              <div
                key={i}
                onClick={() => navigate(step.path)}
                style={{
                  background: C.navyCard,
                  border: `1px solid ${done ? "rgba(0,229,255,0.3)" : "rgba(0,229,255,0.1)"}`,
                  borderRadius: 14,
                  padding: "24px 20px",
                  cursor: "pointer",
                  position: "relative",
                  transition: "border-color 0.15s, transform 0.15s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.transform = "translateY(-2px)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.transform = "none")}
              >
                {done && (
                  <div
                    style={{
                      position: "absolute",
                      top: 14,
                      right: 14,
                      background: C.blue,
                      color: C.navy,
                      borderRadius: 999,
                      width: 22,
                      height: 22,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    ✓
                  </div>
                )}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    background: "rgba(0,229,255,0.1)",
                    border: `1px solid rgba(0,229,255,0.2)`,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    marginBottom: 14,
                  }}
                >
                  {step.icon}
                </div>
                <div style={{ fontSize: 11, color: C.blue, fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>
                  STEP {step.num}
                </div>
                <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>
                  {step.title}
                </h3>
                <p style={{ margin: "0 0 14px", fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
                  {step.description}
                </p>
                <span
                  style={{
                    fontSize: 11,
                    color: C.muted,
                    background: "rgba(0,229,255,0.06)",
                    border: `1px solid rgba(0,229,255,0.15)`,
                    borderRadius: 999,
                    padding: "3px 10px",
                  }}
                >
                  ⏱ {step.time}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Feature showcase ──────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: "0 auto 80px", padding: "0 24px" }}>
        <h2 style={{ textAlign: "center", margin: "0 0 36px", fontSize: 28, fontWeight: 800, color: "#fff" }}>
          Everything you need to hire smarter
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {FEATURES.map((f, i) => (
            <div
              key={i}
              style={{
                background: C.navyLight,
                border: `1px solid rgba(0,229,255,0.08)`,
                borderRadius: 14,
                padding: "24px 20px",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: "#fff" }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA band ──────────────────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 900,
          margin: "0 auto 80px",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${C.navyCard} 0%, rgba(0,229,255,0.08) 100%)`,
            border: `1px solid rgba(0,229,255,0.2)`,
            borderRadius: 20,
            padding: "48px 40px",
            textAlign: "center",
          }}
        >
          <h2 style={{ margin: "0 0 12px", fontSize: 28, fontWeight: 800, color: "#fff" }}>
            Ready to build your dream team?
          </h2>
          <p style={{ margin: "0 auto 28px", maxWidth: 480, fontSize: 16, color: C.muted, lineHeight: 1.6 }}>
            Complete your setup in under 35 minutes and post your first job today.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => navigate("/")}
              style={{
                background: C.blue,
                color: C.navy,
                border: "none",
                borderRadius: 10,
                padding: "14px 32px",
                fontWeight: 700,
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              Complete Setup →
            </button>
            <a
              href="mailto:hello@zorhire.com"
              style={{
                background: "transparent",
                color: C.text,
                border: `1px solid rgba(200,214,229,0.3)`,
                borderRadius: 10,
                padding: "14px 32px",
                fontWeight: 600,
                fontSize: 16,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Book onboarding call
            </a>
          </div>
        </div>
      </section>

      {/* ── Support bar ───────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: `1px solid rgba(0,229,255,0.08)`,
          padding: "28px 40px",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            gap: 32,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.muted }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
            All systems operational
          </div>
          <a href="mailto:hello@zorhire.com" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>
            ✉ hello@zorhire.com
          </a>
          <span style={{ fontSize: 13, color: C.muted }}>💬 Live chat: 9am–6pm IST, Mon–Fri</span>
          <a href="#" style={{ fontSize: 13, color: C.blue, textDecoration: "none" }}>
            📘 docs.zorhire.com
          </a>
        </div>
      </footer>
    </div>
  );
}
