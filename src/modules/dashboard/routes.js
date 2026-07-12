import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { dashboardQuerySchema } from './schema.js';
import { getKpisCtrl } from './controller.js';

export const router = Router();

// Dashboard available to every authenticated role.
router.get('/', authenticate, validate(dashboardQuerySchema, 'query'), getKpisCtrl);
