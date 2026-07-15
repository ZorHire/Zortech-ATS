export type UserRole =
  | "super_admin"
  | "accounts_manager"
  | "vendor_manager"
  | "recruiter"
  | "vendor_user";


export type JobStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "on_hold"
  | "closed_filled"
  | "closed_cancelled"
  | "expired";

export type PipelineStage =
  | "new"
  | "sourced"
  | "screened"
  | "shortlisted"
  | "submitted_to_client"
  | "client_interview_scheduled"
  | "interview_completed"
  | "selected"
  | "offer_extended"
  | "offer_accepted"
  | "offer_rejected"
  | "joined"
  | "disqualified";

export type WorkMode = "remote" | "hybrid" | "onsite";
export type Priority = "low" | "medium" | "high" | "critical";
export type VendorTier = "preferred" | "standard" | "blocked";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed";
export type InterviewType = "phone" | "video" | "face_to_face";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  phone?: string;
  department?: string;
  vendor_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  industry?: string;
  tier: "priority" | "standard";
  website?: string;
  logo_url?: string;
  city?: string;
  country: string;
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  sla_hours: number;
  is_active: boolean;
  created_at: string;
}

export interface Job {
  id: string;
  client_id: string;
  client?: Client;
  title: string;
  department?: string;
  location?: string;
  work_mode: WorkMode;
  employment_type: string;
  experience_min: number;
  experience_max: number;
  salary_min?: number;
  salary_max?: number;
  currency: string;
  headcount: number;
  priority: Priority;
  status: JobStatus;
  description?: string;
  mandatory_skills: string[];
  preferred_skills: string[];
  assigned_recruiter_id?: string;
  assigned_recruiter?: Profile;
  assigned_vendor_id?: string;
  target_start_date?: string;
  sla_deadline?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  application_count?: number;
}

export interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  current_title?: string;
  current_company?: string;
  experience_years: number;
  current_location?: string;
  preferred_location?: string;
  notice_period_days: number;
  current_ctc?: number;
  expected_ctc?: number;
  skills: string[];
  summary?: string;
  resume_url?: string;
  source: string;
  gdpr_consent: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobApplication {
  id: string;
  job_id: string;
  job?: Job;
  candidate_id: string;
  candidate?: Candidate;
  stage: PipelineStage;
  ai_score?: number;
  ai_match_breakdown?: {
    rationale: string;
    strengths: string[];
    gaps: string[];
    model: string;
    scored_at: string;
  };
  rejection_reason?: string;
  notes?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

export interface PipelineEvent {
  id: string;
  application_id: string;
  from_stage?: string;
  to_stage: string;
  changed_by?: string;
  changed_by_profile?: Profile;
  note?: string;
  created_at: string;
}

export interface Vendor {
  id: string;
  company_name: string;
  registration_number?: string;
  gst_id?: string;
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone?: string;
  industry_specializations: string[];
  geographies: string[];
  tier: VendorTier;
  quality_score: number;
  submission_count: number;
  shortlist_rate: number;
  fill_rate: number;
  sla_adherence: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: CampaignStatus;
  recipient_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  unsubscribed_count: number;
  scheduled_at?: string;
  sent_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Interview {
  id: string;
  application_id: string;
  interview_type: InterviewType;
  scheduled_at: string;
  duration_minutes: number;
  interviewer_name?: string;
  interviewer_email?: string;
  meeting_link?: string;
  feedback_score?: number;
  feedback_notes?: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  created_at: string;
}

export interface DashboardStats {
  activeJobs: number;
  totalCandidates: number;
  scheduledInterviews: number;
  offersExtended: number;
  slaBreaches: number;
  newApplicationsToday: number;
}
