import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.').max(120),
  email: z.string().trim().toLowerCase().email('A valid email is required.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  roleId: z.number().int().positive('roleId must be a positive integer.'),
  region: z.string().max(80).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required.'),
  password: z.string().min(1, 'Password is required.'),
});
