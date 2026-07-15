import { baseApi } from "./baseApi";
import type { Job } from "../../types";

export interface DashboardStats {
  active_jobs: number;
  total_candidates: number;
  upcoming_interviews: number;
  sla_alerts: number;
  emails_sent?: number;
  pipeline_stages: { stage: string; count: number }[];
}

export interface ActivityItem {
  type: 'application' | 'stage_change' | 'interview';
  candidate_name: string;
  job_title: string;
  job_location?: string;
  current_location?: string;
  stage?: string;
  from_stage?: string;
  to_stage?: string;
  interview_type?: string;
  scheduled_at?: string;
  created_at: string;
}

export interface TaskItem {
  text: string;
  due: string;
  priority: 'overdue' | 'urgent' | 'normal';
}

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardStats: builder.query<DashboardStats, void>({
      query: () => "/dashboard/stats",
      providesTags: ["Dashboard"],
    }),

    getDashboardActivity: builder.query<ActivityItem[], void>({
      query: () => "/dashboard/activity",
      providesTags: ["Dashboard"],
    }),

    getDashboardTasks: builder.query<TaskItem[], void>({
      query: () => "/dashboard/tasks",
      providesTags: ["Dashboard"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetDashboardStatsQuery,
  useGetDashboardActivityQuery,
  useGetDashboardTasksQuery,
} = dashboardApi;
