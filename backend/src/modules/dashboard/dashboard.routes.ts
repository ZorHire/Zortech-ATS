import { Router } from 'express';
import { getDashboardStats, getRecentActivity, getDashboardTasks } from './dashboard.controller';
import { authMiddleware, tenantIsolation } from '../../middleware/auth';

const router = Router();

router.get('/stats',    authMiddleware, tenantIsolation, getDashboardStats);
router.get('/activity', authMiddleware, tenantIsolation, getRecentActivity);
router.get('/tasks',    authMiddleware, tenantIsolation, getDashboardTasks);

export default router;
