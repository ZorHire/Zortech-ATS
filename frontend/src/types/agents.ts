// AI recruiting agents (autopilot). Mirrors docs/ai-agents.md — keep in sync with the backend.

export type AgentName = "shortlister" | "screener" | "scheduler";

export interface AutopilotSettings {
  job_id: string;
  enabled: boolean;
  /** 0-100, default 70 */
  shortlist_threshold: number;
  /** 0-100, default 65 */
  screen_pass_threshold: number;
  auto_screen: boolean;
  auto_schedule: boolean;
  /** default 45 */
  interview_duration_min: number;
  /** ISO datetimes offered to candidates (future only) */
  interview_slots: string[];
  /** default 25 emails/day for this job */
  daily_outreach_cap: number;
  updated_at: string | null;
}

/** Known actions; the backend may add more, so `action` stays a string. */
export type AgentAction =
  | "shortlisted"
  | "needs_review"
  | "screening_invited"
  | "screening_completed"
  | "screening_passed"
  | "schedule_link_sent"
  | "interview_booked"
  | "skipped"
  | "failed"
  | "paused";

export interface AgentEvent {
  id: string;
  job_id: string | null;
  job_title: string | null;
  application_id: string | null;
  candidate_id: string | null;
  candidate_name: string | null;
  agent: AgentName | "system";
  action: AgentAction | (string & {});
  /** One human sentence. */
  summary: string;
  created_at: string;
}

export interface AgentSummary {
  autopilot_jobs: number;
  today: {
    shortlisted: number;
    needs_review: number;
    screening_invites: number;
    screenings_completed: number;
    interviews_booked: number;
  };
  pending_tasks: number;
  /** Claude + Gemini cost for agent calls this month */
  spend_month_usd: number | null;
}

export interface ShortlistResult {
  score: number;
  decision: "shortlist" | "review" | "not_a_fit";
  strengths: string[];
  gaps: string[];
  must_have_coverage: { skill: string; met: boolean; evidence: string }[];
  reasoning: string;
  model: string;
  created_at: string;
}

export interface ScreeningEvaluation {
  overall_score: number;
  recommendation: "advance" | "review" | "do_not_advance";
  competencies: { name: string; score: number; evidence: string }[];
  logistics: {
    notice_period: string | null;
    expected_ctc: string | null;
    location_ok: boolean | null;
    work_mode_ok: boolean | null;
  };
  red_flags: string[];
  summary: string;
  model: string;
  created_at: string;
}

export interface ScreeningInsight {
  status: "not_started" | "invited" | "in_progress" | "completed" | "expired";
  invited_at: string | null;
  completed_at: string | null;
  evaluation: ScreeningEvaluation | null;
  transcript: { role: "assistant" | "candidate"; content: string }[];
}

export interface BookingInsight {
  status: "sent" | "booked" | "expired";
  slots: string[];
  chosen_slot: string | null;
}

export interface ApplicationInsights {
  application_id: string;
  stage: string;
  needs_review: boolean;
  shortlist: ShortlistResult | null;
  screening: ScreeningInsight | null;
  booking: BookingInsight | null;
  events: AgentEvent[];
}

export interface SchedulingInvite {
  candidate_first_name: string;
  job_title: string;
  company_name: string;
  duration_min: number;
  /** ISO, future only */
  slots: string[];
  status: "open" | "booked" | "expired";
  chosen_slot: string | null;
}

export interface SchedulingConfirmation {
  confirmed: true;
  slot: string;
  interview_id: string;
}
