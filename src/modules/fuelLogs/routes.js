import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { createFuelLogSchema, updateFuelLogSchema, fuelLogQuerySchema } from './schema.js';
import * as ctrl from './controller.js';

export const router = Router();

router.use(authenticate);

// Reads — any authenticated user.
router.get('/', validate(fuelLogQuerySchema, 'query'), ctrl.listCtrl);
router.get('/:id', ctrl.getCtrl);

// Writes — Driver or Fleet Manager.
router.post('/', requireRole('Driver', 'Fleet Manager'), validate(createFuelLogSchema, 'body'), ctrl.createCtrl);
router.put('/:id', requireRole('Driver', 'Fleet Manager'), validate(updateFuelLogSchema, 'body'), ctrl.updateCtrl);
router.delete('/:id', requireRole('Driver', 'Fleet Manager'), ctrl.removeCtrl);
