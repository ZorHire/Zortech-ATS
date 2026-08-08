import { Router } from 'express';
import { listCampaigns, createCampaign, sendCampaignById, deleteCampaign, sendTestEmail } from './campaigns.controller';
import { getCampaignAnalytics, getCampaignRecipients } from './email-tracking.controller';
import { authMiddleware, tenantIsolation, authorize } from '../../middleware/auth';

const router = Router();

const CAMPAIGN_ROLES = ['super_admin', 'accounts_manager', 'recruiter'];

router.get('/', authMiddleware, tenantIsolation, authorize(CAMPAIGN_ROLES), listCampaigns);
router.post('/', authMiddleware, tenantIsolation, authorize(CAMPAIGN_ROLES), createCampaign);
router.post('/test-send', authMiddleware, tenantIsolation, authorize(CAMPAIGN_ROLES), sendTestEmail);
router.post('/:id/send', authMiddleware, tenantIsolation, authorize(CAMPAIGN_ROLES), sendCampaignById);
router.post('/:id/send-test', authMiddleware, tenantIsolation, authorize(CAMPAIGN_ROLES), sendTestEmail);
router.delete('/:id', authMiddleware, tenantIsolation, deleteCampaign);
router.get('/:id/analytics', authMiddleware, tenantIsolation, getCampaignAnalytics);
router.get('/:id/recipients', authMiddleware, tenantIsolation, getCampaignRecipients);

export default router;
