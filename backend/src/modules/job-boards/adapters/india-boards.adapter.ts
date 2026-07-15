import { registerAdapter } from './base.adapter';
import type {
  JobBoardAdapter,
  JobForPosting,
  JobBoardCredentials,
  PostJobResult,
  IncomingApplication,
} from './base.adapter';

function makeSimpleAdapter(
  key: string,
  name: string,
  color: string,
  apiBase: string,
  extraFields: { key: string; label: string; placeholder: string; required: boolean; secret?: boolean }[],
  parseWebhookFn: (body: unknown) => IncomingApplication | null,
): JobBoardAdapter {
  return {
    key,
    name,
    color,
    configFields: [
      { key: 'access_token', label: 'API Key', placeholder: `${name} API key`, required: true, secret: true },
      ...extraFields,
    ],

    async postJob(job: JobForPosting, credentials: JobBoardCredentials): Promise<PostJobResult> {
      if (!credentials.access_token) {
        throw new Error(`${name} API key not configured. Connect ${name} in Settings → Job Boards.`);
      }
      const response = await fetch(`${apiBase}/jobs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title:        job.title,
          description:  job.description,
          location:     job.location,
          skills:       job.mandatory_skills.join(', '),
          experience:   `${job.experience_min}-${job.experience_max}`,
          work_mode:    job.work_mode,
          ...credentials.extra_config,
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`${name} API ${response.status}: ${body}`);
      }
      const data = (await response.json()) as { id?: string; jobId?: string; expiresAt?: string };
      const externalId = data.id || data.jobId || '';
      return {
        external_job_id: externalId,
        expires_at: data.expiresAt ? new Date(data.expiresAt) : undefined,
        status: 'active',
      };
    },

    async withdrawJob(externalJobId: string, credentials: JobBoardCredentials): Promise<void> {
      if (!credentials.access_token) throw new Error(`${name} credentials not configured.`);
      await fetch(`${apiBase}/jobs/${externalJobId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${credentials.access_token}` },
      });
    },

    parseWebhook(body: unknown, _headers: Record<string, string>): IncomingApplication | null {
      return parseWebhookFn(body);
    },
  };
}

// ── Naukri ──────────────────────────────────────────────────────────────────
registerAdapter(makeSimpleAdapter(
  'naukri', 'Naukri', 'bg-orange-500',
  'https://developer.naukri.com/api/v1',
  [{ key: 'extra_config.client_id', label: 'Client ID', placeholder: 'Naukri client ID', required: true }],
  (body) => {
    const p = body as Record<string, unknown>;
    const c = p?.applicant as Record<string, unknown>;
    if (!c?.emailId) return null;
    return {
      board_key: 'naukri',
      external_application_id: String(p.applicationId ?? ''),
      external_job_id:         String(p.jobId ?? ''),
      candidate: {
        first_name: String(c.firstName ?? ''),
        last_name:  String(c.lastName  ?? ''),
        email:      String(c.emailId),
        phone:      c.mobileNo ? String(c.mobileNo) : undefined,
        experience_years: c.totalExp ? Number(c.totalExp) : undefined,
        current_location: c.currentLocation ? String(c.currentLocation) : undefined,
        resume_url: c.resumeUrl ? String(c.resumeUrl) : undefined,
      },
    };
  },
));

// ── Monster India ────────────────────────────────────────────────────────────
registerAdapter(makeSimpleAdapter(
  'monster', 'Monster', 'bg-purple-600',
  'https://partner.monsterindia.com/api/v2',
  [{ key: 'extra_config.account_id', label: 'Account ID', placeholder: 'Monster account ID', required: true }],
  (body) => {
    const p = body as Record<string, unknown>;
    const c = p?.candidate as Record<string, unknown>;
    if (!c?.email) return null;
    const nameParts = ((c.name as string) || '').split(' ');
    return {
      board_key: 'monster',
      external_application_id: String(p.applicationId ?? ''),
      external_job_id:         String(p.jobId ?? ''),
      candidate: {
        first_name: nameParts[0] || '',
        last_name:  nameParts.slice(1).join(' ') || '',
        email:      String(c.email),
        phone:      c.phone     ? String(c.phone)     : undefined,
        resume_url: c.resumeUrl ? String(c.resumeUrl) : undefined,
      },
    };
  },
));

// ── Glassdoor ────────────────────────────────────────────────────────────────
registerAdapter(makeSimpleAdapter(
  'glassdoor', 'Glassdoor', 'bg-green-600',
  'https://api.glassdoor.com/partner/v1',
  [{ key: 'extra_config.partner_id', label: 'Partner ID', placeholder: 'Glassdoor partner ID', required: true }],
  (body) => {
    const p = body as Record<string, unknown>;
    const c = p?.applicant as Record<string, unknown>;
    if (!c?.email) return null;
    const nameParts = ((c.name as string) || '').split(' ');
    return {
      board_key: 'glassdoor',
      external_application_id: String(p.applicationId ?? ''),
      external_job_id:         String(p.listingId ?? ''),
      candidate: {
        first_name: nameParts[0] || '',
        last_name:  nameParts.slice(1).join(' ') || '',
        email:      String(c.email),
        phone:      c.phone     ? String(c.phone)     : undefined,
        resume_url: c.resumeLink ? String(c.resumeLink) : undefined,
      },
    };
  },
));

// ── Shine.com ────────────────────────────────────────────────────────────────
registerAdapter(makeSimpleAdapter(
  'shine', 'Shine', 'bg-yellow-500',
  'https://api.shine.com/v1',
  [],
  (body) => {
    const p = body as Record<string, unknown>;
    const c = p?.candidate as Record<string, unknown>;
    if (!c?.email) return null;
    return {
      board_key: 'shine',
      external_application_id: String(p.applicationId ?? ''),
      external_job_id:         String(p.jobId ?? ''),
      candidate: {
        first_name: String(c.first_name ?? ''),
        last_name:  String(c.last_name  ?? ''),
        email:      String(c.email),
        phone:      c.phone     ? String(c.phone)     : undefined,
        resume_url: c.resumeUrl ? String(c.resumeUrl) : undefined,
      },
    };
  },
));

// ── TimesJobs ────────────────────────────────────────────────────────────────
registerAdapter(makeSimpleAdapter(
  'timesjobs', 'TimesJobs', 'bg-red-600',
  'https://api.timesjobs.com/v1',
  [{ key: 'extra_config.employer_id', label: 'Employer ID', placeholder: 'TimesJobs employer ID', required: true }],
  (body) => {
    const p = body as Record<string, unknown>;
    const c = p?.applicantInfo as Record<string, unknown>;
    if (!c?.emailAddress) return null;
    return {
      board_key: 'timesjobs',
      external_application_id: String(p.applicationRefId ?? ''),
      external_job_id:         String(p.jobRefId ?? ''),
      candidate: {
        first_name: String(c.firstName ?? ''),
        last_name:  String(c.lastName  ?? ''),
        email:      String(c.emailAddress),
        phone:      c.mobileNumber ? String(c.mobileNumber) : undefined,
        experience_years: c.totalExpYears ? Number(c.totalExpYears) : undefined,
        resume_url: c.resumeLink ? String(c.resumeLink) : undefined,
      },
    };
  },
));

// ── Internshala ──────────────────────────────────────────────────────────────
registerAdapter(makeSimpleAdapter(
  'internshala', 'Internshala', 'bg-teal-600',
  'https://internshala.com/api/v1',
  [],
  (body) => {
    const p = body as Record<string, unknown>;
    const c = p?.student as Record<string, unknown>;
    if (!c?.email) return null;
    return {
      board_key: 'internshala',
      external_application_id: String(p.applicationId ?? ''),
      external_job_id:         String(p.listingId ?? ''),
      candidate: {
        first_name: String(c.firstName ?? c.name ?? ''),
        last_name:  String(c.lastName  ?? ''),
        email:      String(c.email),
        phone:      c.phone     ? String(c.phone)     : undefined,
        resume_url: c.resumeUrl ? String(c.resumeUrl) : undefined,
      },
    };
  },
));
