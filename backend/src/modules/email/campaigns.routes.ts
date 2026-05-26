import { Router } from 'express';
import { listCampaigns, createCampaign, sendCampaignById, deleteCampaign } from './email.controller';
import { authMiddleware, tenantIsolation } from '../../middleware/auth';

const router = Router();

router.get('/', authMiddleware, tenantIsolation, listCampaigns);
router.post('/', authMiddleware, tenantIsolation, createCampaign);
router.post('/:id/send', authMiddleware, tenantIsolation, sendCampaignById);
router.delete('/:id', authMiddleware, tenantIsolation, deleteCampaign);

export default router;
