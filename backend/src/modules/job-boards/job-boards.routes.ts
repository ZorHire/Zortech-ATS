import { Router } from 'express';
import { authMiddleware, authorize, tenantIsolation } from '../../middleware/auth';
import * as ctrl from './job-boards.controller';

const router = Router();

const adminRoles = ['super_admin', 'accounts_manager'];

// Board credential management
router.get('/boards',              authMiddleware, tenantIsolation, ctrl.listBoards);
router.post('/boards/:boardKey',   authMiddleware, tenantIsolation, authorize(adminRoles), ctrl.connectBoard);
router.delete('/boards/:boardKey', authMiddleware, tenantIsolation, authorize(adminRoles), ctrl.disconnectBoard);

// Per-job posting actions
router.get('/jobs/:jobId/postings',              authMiddleware, tenantIsolation, ctrl.getJobPostings);
router.post('/jobs/:jobId/publish',              authMiddleware, tenantIsolation, authorize(adminRoles), ctrl.publishJob);
router.delete('/jobs/:jobId/boards/:boardKey',   authMiddleware, tenantIsolation, authorize(adminRoles), ctrl.withdrawJob);

// Webhook receivers — no auth, called by external job boards
router.post('/webhooks/:boardKey', ctrl.handleWebhook);

export default router;
