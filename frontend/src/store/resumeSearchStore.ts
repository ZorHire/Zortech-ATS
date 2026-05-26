import { create } from 'zustand';
import {
  resumeSearchService,
  SearchFilters,
  SearchResult,
} from '../services/resumeSearch.service';

export interface ExtendedFilters extends SearchFilters {
  skills: string[];
  currentRole: string;
  source: string;
  availability: string;
}

interface ResumeSearchState {
  // search inputs
  query: string;
  filters: ExtendedFilters;

  // results
  results: SearchResult[];
  total: number;
  page: number;
  totalPages: number;

  // ui state
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  searched: boolean;

  // actions
  setQuery: (q: string) => void;
  setFilter: <K extends keyof ExtendedFilters>(key: K, value: ExtendedFilters[K]) => void;
  search: () => Promise<void>;
  loadMore: () => Promise<void>;
  reset: () => void;
}

const DEFAULT_FILTERS: ExtendedFilters = {
  location: 'All',
  experience: 'All',
  noticePeriod: 'Any',
  skills: [],
  currentRole: '',
  source: 'All',
  availability: 'All',
};

export const useResumeSearchStore = create<ResumeSearchState>((set, get) => ({
  query: '',
  filters: { ...DEFAULT_FILTERS, skills: [] },

  results: [],
  total: 0,
  page: 1,
  totalPages: 1,

  loading: false,
  loadingMore: false,
  error: null,
  searched: false,

  setQuery: (q) => set({ query: q }),
  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),

  search: async () => {
    const { query, filters } = get();
    set({ loading: true, error: null, searched: false, results: [], page: 1 });
    try {
      const data = await resumeSearchService.search({
        query,
        location: filters.location,
        experience: filters.experience,
        noticePeriod: filters.noticePeriod,
        page: 1,
        limit: 10,
      });
      set({
        results: data.results,
        total: data.total,
        page: data.page,
        totalPages: data.totalPages,
        searched: true,
      });
    } catch (err: any) {
      set({ error: err.message || 'Search failed', searched: true });
    } finally {
      set({ loading: false });
    }
  },

  loadMore: async () => {
    const { query, filters, page, totalPages, results } = get();
    if (page >= totalPages) return;
    set({ loadingMore: true, error: null });
    try {
      const nextPage = page + 1;
      const data = await resumeSearchService.search({
        query,
        location: filters.location,
        experience: filters.experience,
        noticePeriod: filters.noticePeriod,
        page: nextPage,
        limit: 10,
      });
      set({
        results: [...results, ...data.results],
        page: data.page,
        totalPages: data.totalPages,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load more' });
    } finally {
      set({ loadingMore: false });
    }
  },

  reset: () =>
    set({
      query: '',
      filters: { ...DEFAULT_FILTERS, skills: [] },
      results: [],
      total: 0,
      page: 1,
      totalPages: 1,
      loading: false,
      loadingMore: false,
      error: null,
      searched: false,
    }),
}));
