import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import pool from "../../db";
import { PLATFORM_TENANT_ID } from "../tenants/tenantBootstrap.service";
import {
  getOnboardingStatus,
  markOnboardingStep,
  OnboardingStep,
} from "./onboarding.service";

/** GET /v1/onboarding/status — returns the 6-step checklist for the caller's tenant */
export const getStatus = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;

  // Platform owner has no onboarding checklist
  if (tenantId === PLATFORM_TENANT_ID) {
    return res.json({ is_platform_owner: true });
  }

  try {
    const status = await getOnboardingStatus(tenantId);
    if (!status) {
      // Row missing — create it lazily for tenants bootstrapped before this feature
      await pool.query(
        `INSERT INTO tenant_onboarding_status (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [tenantId],
      );
      return res.json(await getOnboardingStatus(tenantId));
    }
    res.json(status);
  } catch (err: any) {
    console.error("[onboarding] getStatus error:", err);
    res.status(500).json({ message: "Failed to fetch onboarding status" });
  }
};

/** PATCH /v1/onboarding/status — mark one step as complete (idempotent) */
export const updateStatus = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const { step } = req.body as { step?: OnboardingStep };

  const ALLOWED_STEPS: OnboardingStep[] = [
    "profile_complete",
    "team_invited",
    "pipeline_created",
    "channel_connected",
  ];

  if (!step || !ALLOWED_STEPS.includes(step)) {
    return res.status(400).json({
      message: `step must be one of: ${ALLOWED_STEPS.join(", ")}`,
    });
  }

  try {
    await markOnboardingStep(tenantId, step);
    res.json({ message: "Step marked as complete", step });
  } catch (err: any) {
    console.error("[onboarding] updateStatus error:", err);
    res.status(500).json({ message: "Failed to update onboarding status" });
  }
};

/** GET /v1/onboarding/account-info — returns account + plan info for email personalisation */
export const getAccountInfo = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const userId = req.user!.id;

  try {
    const result = await pool.query<{
      company_name: string;
      company_email: string | null;
      first_name: string;
      full_name: string;
      plan_type: string | null;
      subscription_status: string | null;
    }>(
      `SELECT
         t.name          AS company_name,
         t.company_email,
         p.full_name,
         SPLIT_PART(p.full_name, ' ', 1) AS first_name,
         s.plan_type,
         s.status        AS subscription_status
       FROM tenants t
       JOIN profiles p ON p.id = $2
       LEFT JOIN subscriptions s ON s.tenant_id = t.id
       WHERE t.id = $1`,
      [tenantId, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Account not found" });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error("[onboarding] getAccountInfo error:", err);
    res.status(500).json({ message: "Failed to fetch account info" });
  }
};
