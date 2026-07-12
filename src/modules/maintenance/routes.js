import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { createMaintenanceSchema, updateMaintenanceSchema } from './schema.js';
import * as ctrl from './controller.js';

export const router = Router();

router.use(authenticate);

// Reads — any authenticated user.
router.get('/', ctrl.listCtrl);
router.get('/:id', ctrl.getCtrl);

// Writes — Fleet Manager only.
router.post('/', requireRole('Fleet Manager'), validate(createMaintenanceSchema, 'body'), ctrl.createCtrl);
router.put('/:id', requireRole('Fleet Manager'), validate(updateMaintenanceSchema, 'body'), ctrl.updateCtrl);
router.delete('/:id', requireRole('Fleet Manager'), ctrl.removeCtrl);
