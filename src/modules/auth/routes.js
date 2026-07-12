import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { registerSchema, loginSchema } from './schema.js';
import { registerCtrl, loginCtrl, meCtrl } from './controller.js';

export const router = Router();

// Open endpoints (no authentication required).
router.post('/register', validate(registerSchema, 'body'), registerCtrl);
router.post('/login', validate(loginSchema, 'body'), loginCtrl);

// Authenticated.
router.get('/me', authenticate, meCtrl);
