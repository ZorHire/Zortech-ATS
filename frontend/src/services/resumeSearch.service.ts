import { Candidate } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/v1';

export interface SearchFilters {
  location: string;
  experience: string;
  noticePeriod: string;
}

export interface SearchResult {
  candidate: Candidate;
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SearchParams extends SearchFilters {
  query: string;
  page?: number;
  limit?: number;
}

function buildQs(params: Record<string, any>): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      qs.set(key, String(val));
    }
  }
  return qs.toString();
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const resumeSearchService = {
  async search(params: SearchParams): Promise<SearchResponse> {
    const qs = buildQs({
      query: params.query,
      location: params.location !== 'All' ? params.location : undefined,
      experience: params.experience !== 'All' ? params.experience : undefined,
      noticePeriod: params.noticePeriod !== 'Any' ? params.noticePeriod : undefined,
      page: params.page ?? 1,
      limit: params.limit ?? 10,
    });

    const res = await fetch(`${API_URL}/candidates/search?${qs}`, {
      headers: authHeaders(),
    });

    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      throw new Error('Session expired');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Search failed' }));
      throw new Error(err.message || 'Search failed');
    }
    return res.json();
  },

  async exportCsv(filters: SearchFilters): Promise<void> {
    const qs = buildQs({
      location: filters.location !== 'All' ? filters.location : undefined,
      experience: filters.experience !== 'All' ? filters.experience : undefined,
      noticePeriod: filters.noticePeriod !== 'Any' ? filters.noticePeriod : undefined,
    });

    const res = await fetch(`${API_URL}/candidates/export?${qs}`, {
      headers: authHeaders(),
    });

    if (!res.ok) throw new Error('Export failed');

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidates_export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  async addToPipeline(candidateId: string, jobId: string): Promise<void> {
    const res = await fetch(`${API_URL}/pipeline/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ candidateId, jobId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed to add to pipeline' }));
      throw new Error(err.message || 'Failed to add to pipeline');
    }
  },

  async addToPipelineWithStage(candidateId: string, jobId: string, stage: string): Promise<void> {
    const res = await fetch(`${API_URL}/pipeline/jobs/${jobId}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ candidate_id: candidateId, stage }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed to add to pipeline' }));
      throw new Error(err.message || 'Failed to add to pipeline');
    }
  },

  async fetchJobs(): Promise<unknown[]> {
    const res = await fetch(`${API_URL}/jobs`, { headers: authHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.jobs ?? [];
  },
};
