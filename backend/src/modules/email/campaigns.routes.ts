import { Router } from 'express';
import { listCampaigns, createCampaign, sendCampaignById, deleteCampaign } from './email.controller';
import { getCampaignAnalytics, getCampaignRecipients } from './email-tracking.controller';
import { authMiddleware, tenantIsolation } from '../../middleware/auth';

const router = Router();

router.get('/', authMiddleware, tenantIsolation, listCampaigns);
router.post('/', authMiddleware, tenantIsolation, createCampaign);
router.post('/:id/send', authMiddleware, tenantIsolation, sendCampaignById);
router.delete('/:id', authMiddleware, tenantIsolation, deleteCampaign);
router.get('/:id/analytics', authMiddleware, tenantIsolation, getCampaignAnalytics);
router.get('/:id/recipients', authMiddleware, tenantIsolation, getCampaignRecipients);

export default router;
