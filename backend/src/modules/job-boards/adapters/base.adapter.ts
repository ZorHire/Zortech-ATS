export interface JobForPosting {
  title: string;
  description: string;
  location: string;
  work_mode: string;
  employment_type: string;
  experience_min: number;
  experience_max: number;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  mandatory_skills: string[];
  preferred_skills?: string[];
}

export interface JobBoardCredentials {
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: Date;
  extra_config?: Record<string, unknown>;
}

export interface PostJobResult {
  external_job_id: string;
  expires_at?: Date;
  status: 'active';
}

export interface IncomingApplication {
  board_key: string;
  external_application_id: string;
  external_job_id: string;
  candidate: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    current_location?: string;
    experience_years?: number;
    resume_url?: string;
    cover_letter?: string;
  };
}

export interface BoardConfigField {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  secret?: boolean;
}

export interface JobBoardAdapter {
  readonly key: string;
  readonly name: string;
  readonly color: string;            // CSS class for badge bg
  readonly configFields: BoardConfigField[];
  postJob(job: JobForPosting, credentials: JobBoardCredentials): Promise<PostJobResult>;
  withdrawJob(externalJobId: string, credentials: JobBoardCredentials): Promise<void>;
  refreshToken?(credentials: JobBoardCredentials): Promise<{ access_token: string; expires_at: Date }>;
  parseWebhook(body: unknown, headers: Record<string, string>): IncomingApplication | null;
}

const ADAPTERS: Record<string, JobBoardAdapter> = {};

export function registerAdapter(adapter: JobBoardAdapter): void {
  ADAPTERS[adapter.key] = adapter;
}

export function getAdapter(key: string): JobBoardAdapter | null {
  return ADAPTERS[key] ?? null;
}

export function getAllAdapters(): JobBoardAdapter[] {
  return Object.values(ADAPTERS);
}
