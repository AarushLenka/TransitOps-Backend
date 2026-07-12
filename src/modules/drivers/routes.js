import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { createDriverSchema, updateDriverSchema, driverQuerySchema } from './schema.js';
import * as ctrl from './controller.js';

export const router = Router();

router.use(authenticate);

// Reads — any authenticated user.
router.get('/', validate(driverQuerySchema, 'query'), ctrl.listCtrl);
router.get('/:id', ctrl.getCtrl);

// Writes — Fleet Manager or Safety Officer (Safety Officer maintains safetyScore).
router.post('/', requireRole('Fleet Manager', 'Safety Officer'), validate(createDriverSchema, 'body'), ctrl.createCtrl);
router.put('/:id', requireRole('Fleet Manager', 'Safety Officer'), validate(updateDriverSchema, 'body'), ctrl.updateCtrl);
router.delete('/:id', requireRole('Fleet Manager', 'Safety Officer'), ctrl.removeCtrl);
