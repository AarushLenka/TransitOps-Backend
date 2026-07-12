import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { createExpenseSchema, updateExpenseSchema, expenseQuerySchema } from './schema.js';
import * as ctrl from './controller.js';

export const router = Router();

router.use(authenticate);

// Reads — any authenticated user.
router.get('/', validate(expenseQuerySchema, 'query'), ctrl.listCtrl);
router.get('/:id', ctrl.getCtrl);

// Writes — Driver or Financial Analyst (Financial Analyst owns expense review).
router.post('/', requireRole('Driver', 'Financial Analyst'), validate(createExpenseSchema, 'body'), ctrl.createCtrl);
router.put('/:id', requireRole('Driver', 'Financial Analyst'), validate(updateExpenseSchema, 'body'), ctrl.updateCtrl);
router.delete('/:id', requireRole('Driver', 'Financial Analyst'), ctrl.removeCtrl);
