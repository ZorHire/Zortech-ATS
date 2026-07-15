import { baseApi } from './baseApi';

export interface BoardInfo {
  key: string;
  name: string;
  color: string;
  configFields: Array<{
    key: string;
    label: string;
    placeholder: string;
    required: boolean;
    secret?: boolean;
  }>;
  connected: boolean;
  connected_at: string | null;
}

export interface JobPosting {
  board_key: string;
  board_name: string;
  board_color: string;
  status: 'not_posted' | 'pending' | 'active' | 'expired' | 'error' | 'withdrawn';
  external_job_id: string | null;
  posted_at: string | null;
  expires_at: string | null;
  error_message: string | null;
  application_count: number;
  updated_at: string | null;
}

export interface PublishResult {
  board_key: string;
  success: boolean;
  error?: string;
}

export const jobBoardsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listBoards: builder.query<{ boards: BoardInfo[] }, void>({
      query: () => '/job-boards/boards',
      providesTags: ['JobBoards'],
    }),

    connectBoard: builder.mutation<{ message: string }, {
      boardKey: string;
      access_token: string;
      refresh_token?: string;
      token_expires_at?: string;
      webhook_secret?: string;
      extra_config?: Record<string, unknown>;
    }>({
      query: ({ boardKey, ...body }) => ({
        url: `/job-boards/boards/${boardKey}`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['JobBoards'],
    }),

    disconnectBoard: builder.mutation<{ message: string }, string>({
      query: (boardKey) => ({ url: `/job-boards/boards/${boardKey}`, method: 'DELETE' }),
      invalidatesTags: ['JobBoards'],
    }),

    getJobPostings: builder.query<{ postings: JobPosting[] }, string>({
      query: (jobId) => `/job-boards/jobs/${jobId}/postings`,
      providesTags: (_r, _e, jobId) => [{ type: 'JobBoardPostings', id: jobId }],
    }),

    publishJob: builder.mutation<{ results: PublishResult[] }, { jobId: string; board_keys: string[] }>({
      query: ({ jobId, board_keys }) => ({
        url: `/job-boards/jobs/${jobId}/publish`,
        method: 'POST',
        body: { board_keys },
      }),
      invalidatesTags: (_r, _e, { jobId }) => [{ type: 'JobBoardPostings', id: jobId }],
    }),

    withdrawFromBoard: builder.mutation<{ message: string }, { jobId: string; boardKey: string }>({
      query: ({ jobId, boardKey }) => ({
        url: `/job-boards/jobs/${jobId}/boards/${boardKey}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { jobId }) => [{ type: 'JobBoardPostings', id: jobId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListBoardsQuery,
  useConnectBoardMutation,
  useDisconnectBoardMutation,
  useGetJobPostingsQuery,
  usePublishJobMutation,
  useWithdrawFromBoardMutation,
} = jobBoardsApi;
