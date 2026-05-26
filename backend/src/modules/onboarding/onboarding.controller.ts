import { Response } from 'express';
import pool from '../../db';
import { AuthRequest } from '../../middleware/auth';

export const getOnboardingStatus = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;

  try {
    const stored = await pool.query(
      `SELECT * FROM tenant_onboarding_status WHERE tenant_id = $1`,
      [tenantId],
    );

    let row = stored.rows[0];

    if (!row) {
      const [profileRes, teamRes, emailConfigRes, jobsRes] = await Promise.all([
        pool.query(
          `SELECT 1 FROM profiles p
           JOIN tenant_memberships m ON p.id = m.user_id
           WHERE m.tenant_id = $1 AND p.full_name IS NOT NULL AND p.full_name != ''
           LIMIT 1`,
          [tenantId],
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM tenant_memberships
           WHERE tenant_id = $1 AND is_active = true`,
          [tenantId],
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM user_email_config uec
           JOIN tenant_memberships m ON uec.user_id = m.user_id
           WHERE m.tenant_id = $1`,
          [tenantId],
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM jobs
           WHERE tenant_id = $1 AND deleted_at IS NULL`,
          [tenantId],
        ),
      ]);

      const profileComplete = profileRes.rows.length > 0;
      const teamInvited = teamRes.rows[0].count > 1;
      const channelConnected = emailConfigRes.rows[0].count > 0;
      const firstJobPosted = jobsRes.rows[0].count > 0;

      row = {
        tenant_id: tenantId,
        account_created: true,
        profile_complete: profileComplete,
        team_invited: teamInvited,
        pipeline_created: firstJobPosted,
        channel_connected: channelConnected,
        first_job_posted: firstJobPosted,
      };
    }

    const steps = [
      row.account_created,
      row.profile_complete,
      row.team_invited,
      row.pipeline_created,
      row.channel_connected,
      row.first_job_posted,
    ];
    const completedSteps = steps.filter(Boolean).length;
    const totalSteps = steps.length;

    res.json({
      tenant_id: row.tenant_id,
      account_created: row.account_created,
      profile_complete: row.profile_complete,
      team_invited: row.team_invited,
      pipeline_created: row.pipeline_created,
      channel_connected: row.channel_connected,
      first_job_posted: row.first_job_posted,
      completed_steps: completedSteps,
      total_steps: totalSteps,
      percent_complete: Math.round((completedSteps / totalSteps) * 100),
    });
  } catch (error) {
    console.error('Onboarding status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
