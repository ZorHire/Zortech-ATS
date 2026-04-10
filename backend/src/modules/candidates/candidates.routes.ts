import { Router } from 'express';
import * as candidateController from './candidates.controller';
import { authMiddleware, authorize, tenantIsolation } from '../../middleware/auth';

const router = Router();

router.get('/', authMiddleware, tenantIsolation, candidateController.getCandidates);
router.get('/:id', authMiddleware, tenantIsolation, candidateController.getCandidateById);
router.post('/', authMiddleware, tenantIsolation, authorize(['super_admin', 'ats_admin', 'senior_recruiter', 'recruiter', 'sourcing_specialist']), candidateController.createCandidate);
router.patch('/:id', authMiddleware, tenantIsolation, authorize(['super_admin', 'ats_admin', 'senior_recruiter', 'recruiter', 'sourcing_specialist']), candidateController.updateCandidate);
router.delete('/:id', authMiddleware, tenantIsolation, authorize(['super_admin', 'ats_admin', 'senior_recruiter', 'recruiter', 'sourcing_specialist']), candidateController.deleteCandidate);

export default router;