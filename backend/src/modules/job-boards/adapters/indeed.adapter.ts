import { registerAdapter } from './base.adapter';
import type {
  JobBoardAdapter,
  JobForPosting,
  JobBoardCredentials,
  PostJobResult,
  IncomingApplication,
} from './base.adapter';

const indeedAdapter: JobBoardAdapter = {
  key: 'indeed',
  name: 'Indeed',
  color: 'bg-indigo-600',
  configFields: [
    { key: 'access_token',              label: 'API Key',      placeholder: 'Indeed API key', required: true, secret: true },
    { key: 'extra_config.publisher_id', label: 'Publisher ID', placeholder: 'Indeed publisher ID', required: true },
  ],

  async postJob(job: JobForPosting, credentials: JobBoardCredentials): Promise<PostJobResult> {
    if (!credentials.access_token) {
      throw new Error('Indeed API key not configured. Connect Indeed in Settings → Job Boards.');
    }
    const publisherId = credentials.extra_config?.publisher_id as string;
    if (!publisherId) throw new Error('Indeed Publisher ID is required.');

    const response = await fetch('https://apis.indeed.com/ads/apisearch/job/post', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publisher:   publisherId,
        title:       job.title,
        description: job.description,
        location:    job.location,
        type:        mapEmploymentType(job.employment_type),
        remote:      job.work_mode === 'remote',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Indeed API ${response.status}: ${body}`);
    }

    const data = (await response.json()) as { jobKey: string; expirationDate?: string };
    return {
      external_job_id: data.jobKey,
      expires_at: data.expirationDate ? new Date(data.expirationDate) : undefined,
      status: 'active',
    };
  },

  async withdrawJob(externalJobId: string, credentials: JobBoardCredentials): Promise<void> {
    if (!credentials.access_token) throw new Error('Indeed credentials not configured.');
    await fetch(`https://apis.indeed.com/ads/apisearch/job/${externalJobId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${credentials.access_token}` },
    });
  },

  parseWebhook(body: unknown, _headers: Record<string, string>): IncomingApplication | null {
    const payload   = body as Record<string, unknown>;
    const candidate = payload?.candidate as Record<string, unknown>;
    if (!candidate?.email) return null;

    const nameParts = ((candidate.fullName as string) || '').split(' ');
    return {
      board_key: 'indeed',
      external_application_id: String(payload.applicationId ?? ''),
      external_job_id:         String(payload.jobKey ?? ''),
      candidate: {
        first_name:   nameParts[0] || '',
        last_name:    nameParts.slice(1).join(' ') || '',
        email:        String(candidate.email),
        phone:        candidate.phone       ? String(candidate.phone)       : undefined,
        resume_url:   candidate.resumeUrl   ? String(candidate.resumeUrl)   : undefined,
        cover_letter: candidate.coverLetter ? String(candidate.coverLetter) : undefined,
      },
    };
  },
};

function mapEmploymentType(type: string): string {
  const m: Record<string, string> = { full_time: 'fulltime', part_time: 'parttime', contract: 'contract', internship: 'internship' };
  return m[type] || 'fulltime';
}

registerAdapter(indeedAdapter);
export default indeedAdapter;
