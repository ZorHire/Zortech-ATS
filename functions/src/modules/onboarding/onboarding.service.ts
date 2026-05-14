import { PoolClient } from "pg";
import pool from "../../db";

export type OnboardingStep =
  | "account_created"
  | "profile_complete"
  | "team_invited"
  | "pipeline_created"
  | "channel_connected"
  | "first_job_posted"
  | "welcome_email_sent";

export interface OnboardingStatus {
  tenant_id: string;
  account_created: boolean;
  profile_complete: boolean;
  team_invited: boolean;
  pipeline_created: boolean;
  channel_connected: boolean;
  first_job_posted: boolean;
  welcome_email_sent: boolean;
  completed_steps: number;
  total_steps: number;
  percent_complete: number;
}

const CHECKLIST_STEPS: OnboardingStep[] = [
  "account_created",
  "profile_complete",
  "team_invited",
  "pipeline_created",
  "channel_connected",
  "first_job_posted",
];

export async function getOnboardingStatus(tenantId: string): Promise<OnboardingStatus | null> {
  const result = await pool.query(
    `SELECT * FROM tenant_onboarding_status WHERE tenant_id = $1`,
    [tenantId],
  );
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const completedSteps = CHECKLIST_STEPS.filter((s) => row[s]).length;

  return {
    tenant_id: tenantId,
    account_created: row.account_created,
    profile_complete: row.profile_complete,
    team_invited: row.team_invited,
    pipeline_created: row.pipeline_created,
    channel_connected: row.channel_connected,
    first_job_posted: row.first_job_posted,
    welcome_email_sent: row.welcome_email_sent,
    completed_steps: completedSteps,
    total_steps: CHECKLIST_STEPS.length,
    percent_complete: Math.round((completedSteps / CHECKLIST_STEPS.length) * 100),
  };
}

export async function markOnboardingStep(
  tenantId: string,
  step: OnboardingStep,
  value = true,
): Promise<void> {
  await pool.query(
    `UPDATE tenant_onboarding_status SET ${step} = $2, updated_at = now() WHERE tenant_id = $1`,
    [tenantId, value],
  );
}

/** Called inside bootstrapTenant() transaction to initialize the row. */
export async function initOnboardingStatus(
  tenantId: string,
  client: PoolClient,
): Promise<void> {
  await client.query(
    `INSERT INTO tenant_onboarding_status (tenant_id)
     VALUES ($1)
     ON CONFLICT (tenant_id) DO NOTHING`,
    [tenantId],
  );
}
