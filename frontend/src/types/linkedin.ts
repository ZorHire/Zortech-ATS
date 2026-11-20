export type Network = "F" | "S" | "O";
export type Resolvable = "locations" | "current_companies" | "past_companies" | "industries" | "schools";

export interface SearchFilters {
  keywords: string;
  title_keywords: string;
  locations: string[];
  current_companies: string[];
  past_companies: string[];
  industries: string[];
  schools: string[];
  network: Network[];
  profile_languages: string[];
  exclude_keywords: string[];
  resolved?: Record<Resolvable, Record<string, string>>;
}

export interface RecruiterSearch {
  boolean: string;
  job_titles: string[];
  skills: string[];
  locations: string[];
  companies: string[];
  industries: string[];
  years_experience_min: number | null;
  years_experience_max: number | null;
  seniority: string[];
  tips: string;
}

export type CampaignStatus = "draft" | "active" | "paused" | "completed";
export type CampaignChannel = "linkedin" | "recruiter_lite";

export interface CampaignStats {
  total: number;
  to_review: number;
  new: number;
  approved: number;
  sent: number;
  accepted: number;
  skipped: number;
  failed: number;
  sent_today: number;
}

export interface LinkedInCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  channel: CampaignChannel;
  job_id: string | null;
  job_title: string | null;
  owner_user_id: string;
  owner_name: string | null;
  search: SearchFilters;
  recruiter_search: RecruiterSearch | null;
  note_instructions: string | null;
  use_notes: boolean;
  daily_invite_limit: number;
  auto_send: boolean;
  min_score: number;
  max_pages: number;
  search_requested_at: string | null;
  last_search_at: string | null;
  search_url: string;
  unresolved: Record<Resolvable, string[]>;
  stats: CampaignStats;
  rationale?: string | null;
  created_at: string;
  updated_at: string;
}

export type CampaignInput = Partial<
  Pick<
    LinkedInCampaign,
    "name" | "channel" | "search" | "recruiter_search" | "note_instructions" | "use_notes" | "daily_invite_limit" | "auto_send" | "min_score" | "max_pages"
  >
> & { job_id?: string | null; generate?: boolean };

export type ProspectStatus =
  | "new"
  | "scored"
  | "approved"
  | "queued"
  | "sent"
  | "accepted"
  | "skipped"
  | "failed"
  | "needs_email"
  | "already_connected";

export interface LinkedInProspect {
  id: string;
  public_id: string | null;
  profile_url: string | null;
  recruiter_url: string | null;
  full_name: string | null;
  headline: string | null;
  location: string | null;
  degree: string | null;
  snippet: string | null;
  match_score: number | null;
  match_reasons: string[] | null;
  note: string | null;
  inmail_subject: string | null;
  note_edited: boolean;
  status: ProspectStatus;
  error: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  candidate_id: string | null;
  created_at: string;
}

export interface LinkedInAccountStatus {
  connected: boolean;
  extension_online: boolean;
  tokens: { id: string; label: string | null; created_at: string; last_used_at: string | null }[];
  linkedin: null | {
    name: string | null;
    public_id: string | null;
    headline: string | null;
    has_premium: boolean;
    recruiter_lite_detected: boolean;
    recruiter_lite_override: boolean | null;
    recruiter_lite: boolean;
    ext_version: string | null;
    last_seen_at: string;
    paused_reason: string | null;
    paused_until: string | null;
  };
  limits: { weekly_cap: number; daily_cap: number; sent_this_week: number; sent_today: number };
}

export interface LinkedInSummary {
  sent: number;
  accepted: number;
  to_review: number;
  active_campaigns: number;
  sent_today: number;
  sent_this_week: number;
}

export interface FreeBoard {
  key: string;
  name: string;
  postUrl: string;
  loginUrl: string;
  signupUrl: string;
  bestFor: string;
  freeTier: string;
  accepts: string[];
  suitable?: boolean;
  freshers_only?: boolean;
  maxExperience?: number;
  post?: null | {
    id: string;
    status: "requested" | "opened" | "posted" | "skipped" | "failed";
    posting_url: string | null;
    error: string | null;
    requested_at: string;
    opened_at: string | null;
    posted_at: string | null;
  };
}
