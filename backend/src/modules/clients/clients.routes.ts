import { Router } from 'express';
import * as clientController from './clients.controller';
import { authMiddleware, authorize, tenantIsolation } from '../../middleware/auth';

const router = Router();

router.get('/', authMiddleware, tenantIsolation, clientController.getClients);
router.get('/:id', authMiddleware, tenantIsolation, clientController.getClientById);
router.post('/', authMiddleware, tenantIsolation, authorize(['super_admin', 'accounts_manager']), clientController.createClient);
router.patch('/:id', authMiddleware, tenantIsolation, authorize(['super_admin', 'accounts_manager']), clientController.updateClient);
router.delete('/:id', authMiddleware, tenantIsolation, authorize(['super_admin', 'accounts_manager']), clientController.deleteClient);

export default router;