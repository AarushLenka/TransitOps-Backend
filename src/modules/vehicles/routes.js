import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { createVehicleSchema, updateVehicleSchema, vehicleQuerySchema } from './schema.js';
import * as ctrl from './controller.js';

export const router = Router();

// All vehicle endpoints require authentication.
router.use(authenticate);

// Reads — any authenticated user (dashboard-friendly).
router.get('/', validate(vehicleQuerySchema, 'query'), ctrl.listCtrl);
router.get('/:id', ctrl.getCtrl);

// Writes — Fleet Manager only.
router.post('/', requireRole('Fleet Manager'), validate(createVehicleSchema, 'body'), ctrl.createCtrl);
router.put('/:id', requireRole('Fleet Manager'), validate(updateVehicleSchema, 'body'), ctrl.updateCtrl);
router.delete('/:id', requireRole('Fleet Manager'), ctrl.removeCtrl);
