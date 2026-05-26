import { Router } from 'express';
import { getOnboardingStatus } from './onboarding.controller';
import { authMiddleware, tenantIsolation } from '../../middleware/auth';

const router = Router();

router.get('/status', authMiddleware, tenantIsolation, getOnboardingStatus);

export default router;
