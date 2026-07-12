import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { createTripSchema, completeTripSchema, tripQuerySchema } from './schema.js';
import * as ctrl from './controller.js';

export const router = Router();

router.use(authenticate);

// Reads — any authenticated user.
router.get('/', validate(tripQuerySchema, 'query'), ctrl.listCtrl);
router.get('/:id', ctrl.getCtrl);

// State-machine + write ops — Driver or Fleet Manager.
const tripActors = requireRole('Driver', 'Fleet Manager');

router.post('/', tripActors, validate(createTripSchema, 'body'), ctrl.createCtrl);
router.post('/:id/dispatch', tripActors, ctrl.dispatchCtrl);
router.post('/:id/complete', tripActors, validate(completeTripSchema, 'body'), ctrl.completeCtrl);
router.post('/:id/cancel', tripActors, ctrl.cancelCtrl);
router.delete('/:id', tripActors, ctrl.removeCtrl);
