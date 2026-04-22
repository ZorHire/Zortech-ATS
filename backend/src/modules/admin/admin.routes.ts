import { Router } from 'express';
import * as adminController from './admin.controller';
import * as analyticsController from './analytics.controller';
import { authMiddleware, authorize, tenantIsolation } from '../../middleware/auth';

const router = Router();

// Only super_admin and accounts_manager can access user management
router.get('/users', authMiddleware, tenantIsolation, authorize(['super_admin', 'accounts_manager']), adminController.listUsers);
router.post('/users', authMiddleware, tenantIsolation, authorize(['super_admin', 'accounts_manager']), adminController.createUser);
router.patch('/users/:id', authMiddleware, tenantIsolation, authorize(['super_admin', 'accounts_manager']), adminController.updateUser);
router.post('/users/:id/reset-password', authMiddleware, tenantIsolation, authorize(['super_admin', 'accounts_manager']), adminController.resetPassword);

// Analytics
router.get('/analytics/export', authMiddleware, tenantIsolation, analyticsController.exportAnalytics);

export default router;