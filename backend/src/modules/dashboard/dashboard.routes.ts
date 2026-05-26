import { Router } from 'express';
import { getDashboardStats } from './dashboard.controller';
import { authMiddleware, tenantIsolation } from '../../middleware/auth';

const router = Router();

router.get('/stats', authMiddleware, tenantIsolation, getDashboardStats);

export default router;
