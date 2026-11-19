# ZorHire AI agents (autopilot)

Recruiting agents that take a candidate from "added to a job" to "interview booked",
per job, with every action logged. Built on the existing AI layer
(`services/modelRouter.ts`, `services/aiCallLog.ts` budgets + call log).

## Agents

| Agent | Model | What it does | Trigger |
|---|---|---|---|
| Parser | Gemini (existing `parse.utils.ts`) | Resume/JD → structured fields | Upload (unchanged) |
| **Shortlister** | Claude (`claude-opus-5-5`, effort `medium`) | Scores a candidate against the job (0–100), lists strengths/gaps, decides `shortlist` / `review` / `not_a_fit` | New application on an autopilot job, or "Run shortlister" |
| **Screening interviewer** | Claude (`claude-opus-5-5`, effort `low`) | Runs the candidate-facing text interview (existing `/screening/:sessionId` link), then writes a structured evaluation | Shortlisted + `auto_screen` |
| **Scheduler** | No LLM | Emails the candidate a link to pick one of the job's interview slots, creates the interview, moves the stage | Screening passed + `auto_schedule` |

### Autopilot rules (safety)

- Per-job switch (`job_autopilot.enabled`), plus **Pause all** for the tenant.
- Autopilot **never disqualifies**. `not_a_fit` and low screening scores are marked **Needs review** for a recruiter.
- Candidate-facing emails respect `daily_outreach_cap` per job and are sent from the tenant's mailbox (existing SMTP config). No mailbox → the step is skipped and logged.
- Every action writes an `agent_events` row (shown in the activity feed) and AI stage moves are written with `actor_type = 'ai'`.
- Model calls go through `checkBudget` / `logAiCall` (monthly USD caps per agent).
- Candidate data inside prompts is wrapped as untrusted input (`wrapUntrusted`), and bias-revealing text is stripped before scoring (as in `services/scoring.ts`).

### Stage flow on autopilot

`new|sourced` → shortlister → `shortlisted` (score ≥ `shortlist_threshold`) or stays + **Needs review**
→ screening invite sent → candidate completes chat → evaluation
→ pass (score ≥ `screen_pass_threshold`) → stage `screened` → scheduler emails slot link
→ candidate picks a slot → interview created → stage `client_interview_scheduled`.

## Data (migration `020_ai_autopilot.sql`)

- `job_autopilot` — per-job settings (see API below).
- `agent_tasks` — durable queue processed every minute by `scheduler.ts` (retries with backoff, one pending task per application+agent).
- `agent_events` — activity feed.
- `job_applications.ai_shortlist jsonb` — latest shortlister result.
- `screening_sessions.evaluation jsonb`, `completed_at`.
- `interview_bookings` — slot-picking links (token hash, offered slots, choice).

## API (all under `/v1`, JSON)

Authenticated (recruiter roles), tenant-scoped:

```
GET  /agents/jobs/:jobId/autopilot          -> AutopilotSettings
PUT  /agents/jobs/:jobId/autopilot          body: Partial<AutopilotSettings> -> AutopilotSettings
GET  /agents/activity?jobId=&applicationId=&limit=50 -> AgentEvent[]
GET  /agents/summary                        -> AgentSummary
POST /agents/pause-all                      -> { paused: number }
POST /agents/applications/:id/run           body: { agent: "shortlister" | "screener" | "scheduler" } -> { queued: true }
GET  /agents/applications/:id/insights      -> ApplicationInsights
```

Public (candidate, token in URL, no auth):

```
GET  /scheduling/:token                     -> SchedulingInvite
POST /scheduling/:token                     body: { slot: string /* ISO */ } -> { confirmed: true, slot, interview_id }
```

### Types

```ts
type AgentName = "shortlister" | "screener" | "scheduler";

interface AutopilotSettings {
  job_id: string;
  enabled: boolean;
  shortlist_threshold: number;      // default 70 (0-100)
  screen_pass_threshold: number;    // default 65 (0-100)
  auto_screen: boolean;             // default true
  auto_schedule: boolean;           // default true
  interview_duration_min: number;   // default 45
  interview_slots: string[];        // ISO datetimes offered to candidates (future only)
  daily_outreach_cap: number;       // default 25 emails/day for this job
  updated_at: string | null;
}

interface AgentEvent {
  id: string;
  job_id: string | null;
  job_title: string | null;
  application_id: string | null;
  candidate_id: string | null;
  candidate_name: string | null;
  agent: AgentName | "system";
  action: string;   // e.g. "shortlisted", "needs_review", "screening_invited", "screening_completed",
                    // "screening_passed", "schedule_link_sent", "interview_booked", "skipped", "failed", "paused"
  summary: string;  // one human sentence, e.g. "Scored 84/100 — strong SAP FICO + S/4HANA; shortlisted."
  created_at: string;
}

interface AgentSummary {
  autopilot_jobs: number;
  today: { shortlisted: number; needs_review: number; screening_invites: number;
           screenings_completed: number; interviews_booked: number; };
  pending_tasks: number;
  spend_month_usd: number | null;   // Claude + Gemini cost for agent calls this month
}

interface ShortlistResult {
  score: number;                     // 0-100
  decision: "shortlist" | "review" | "not_a_fit";
  strengths: string[]; gaps: string[];
  must_have_coverage: { skill: string; met: boolean; evidence: string }[];
  reasoning: string;                 // 2-4 sentences
  model: string; created_at: string;
}

interface ScreeningEvaluation {
  overall_score: number;             // 0-100
  recommendation: "advance" | "review" | "do_not_advance";
  competencies: { name: string; score: number; evidence: string }[];
  logistics: { notice_period: string | null; expected_ctc: string | null; location_ok: boolean | null; work_mode_ok: boolean | null };
  red_flags: string[];
  summary: string;
  model: string; created_at: string;
}

interface ApplicationInsights {
  application_id: string;
  stage: string;
  needs_review: boolean;
  shortlist: ShortlistResult | null;
  screening: { status: "not_started" | "invited" | "in_progress" | "completed" | "expired";
               invited_at: string | null; completed_at: string | null;
               evaluation: ScreeningEvaluation | null;
               transcript: { role: "assistant" | "candidate"; content: string }[] } | null;
  booking: { status: "sent" | "booked" | "expired"; slots: string[]; chosen_slot: string | null } | null;
  events: AgentEvent[];
}

interface SchedulingInvite {
  candidate_first_name: string;
  job_title: string;
  company_name: string;
  duration_min: number;
  slots: string[];                    // ISO, future only
  status: "open" | "booked" | "expired";
  chosen_slot: string | null;
}
```
