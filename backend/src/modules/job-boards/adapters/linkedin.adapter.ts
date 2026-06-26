import { registerAdapter } from './base.adapter';
import type {
  JobBoardAdapter,
  JobForPosting,
  JobBoardCredentials,
  PostJobResult,
  IncomingApplication,
} from './base.adapter';

const linkedinAdapter: JobBoardAdapter = {
  key: 'linkedin',
  name: 'LinkedIn',
  color: 'bg-blue-600',
  configFields: [
    { key: 'access_token',             label: 'Access Token',   placeholder: 'OAuth access token', required: true,  secret: true },
    { key: 'extra_config.client_id',   label: 'Client ID',      placeholder: 'LinkedIn app client_id', required: false },
    { key: 'extra_config.client_secret', label: 'Client Secret', placeholder: 'LinkedIn app client_secret', required: false, secret: true },
    { key: 'extra_config.partner_id',  label: 'Partner / Org ID', placeholder: 'LinkedIn organization URN number', required: true },
    { key: 'refresh_token',            label: 'Refresh Token',  placeholder: 'OAuth refresh token (optional)', required: false, secret: true },
  ],

  async postJob(job: JobForPosting, credentials: JobBoardCredentials): Promise<PostJobResult> {
    if (!credentials.access_token) {
      throw new Error('LinkedIn access token not configured. Connect LinkedIn in Settings → Job Boards.');
    }
    const partnerId = credentials.extra_config?.partner_id as string;
    if (!partnerId) throw new Error('LinkedIn Partner / Org ID is required.');

    const response = await fetch('https://api.linkedin.com/v2/jobPostings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        title: job.title,
        description: { text: job.description },
        employmentStatus: mapEmploymentType(job.employment_type),
        location: { country: 'IN', city: job.location.split(',')[0].trim() },
        listedAt: Date.now(),
        integrationContext: `urn:li:organization:${partnerId}`,
        workplaceType: mapWorkMode(job.work_mode),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`LinkedIn API ${response.status}: ${body}`);
    }

    const data = (await response.json()) as { id: string };
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    return { external_job_id: data.id, expires_at: expiresAt, status: 'active' };
  },

  async withdrawJob(externalJobId: string, credentials: JobBoardCredentials): Promise<void> {
    if (!credentials.access_token) throw new Error('LinkedIn credentials not configured.');
    await fetch(`https://api.linkedin.com/v2/jobPostings/${externalJobId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${credentials.access_token}` },
    });
  },

  async refreshToken(credentials: JobBoardCredentials): Promise<{ access_token: string; expires_at: Date }> {
    const clientId     = credentials.extra_config?.client_id as string;
    const clientSecret = credentials.extra_config?.client_secret as string;
    if (!clientId || !clientSecret || !credentials.refresh_token) {
      throw new Error('LinkedIn OAuth credentials incomplete for token refresh.');
    }
    const params = new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: credentials.refresh_token,
      client_id:     clientId,
      client_secret: clientSecret,
    });
    const resp = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!resp.ok) throw new Error('LinkedIn token refresh failed.');
    const data = (await resp.json()) as { access_token: string; expires_in: number };
    return { access_token: data.access_token, expires_at: new Date(Date.now() + data.expires_in * 1000) };
  },

  parseWebhook(body: unknown, _headers: Record<string, string>): IncomingApplication | null {
    const payload = body as Record<string, unknown>;
    if (!payload || payload.event_type !== 'APPLICATION_RECEIVED') return null;

    const app       = payload.application as Record<string, unknown>;
    const applicant = app?.applicant   as Record<string, unknown>;
    if (!applicant?.email_address) return null;

    const nameParts = ((applicant.name as string) || '').split(' ');
    return {
      board_key: 'linkedin',
      external_application_id: String(app?.id ?? ''),
      external_job_id:         String(app?.job_posting_id ?? ''),
      candidate: {
        first_name: nameParts[0] || '',
        last_name:  nameParts.slice(1).join(' ') || '',
        email:      String(applicant.email_address),
        phone:      applicant.phone      ? String(applicant.phone)      : undefined,
        resume_url: applicant.resume_url ? String(applicant.resume_url) : undefined,
      },
    };
  },
};

function mapEmploymentType(type: string): string {
  const m: Record<string, string> = { full_time: 'FULL_TIME', part_time: 'PART_TIME', contract: 'CONTRACT', internship: 'INTERNSHIP' };
  return m[type] || 'FULL_TIME';
}

function mapWorkMode(mode: string): string {
  const m: Record<string, string> = { remote: 'REMOTE', hybrid: 'HYBRID', onsite: 'ON_SITE' };
  return m[mode] || 'ON_SITE';
}

registerAdapter(linkedinAdapter);
export default linkedinAdapter;
