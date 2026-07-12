import { z } from 'zod';

const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'A valid ISO date is required.')
  .transform((v) => new Date(v));

const optionalDate = z
  .union([z.string(), z.null()])
  .optional()
  .refine((v) => v == null || (typeof v === 'string' && !Number.isNaN(Date.parse(v))), 'A valid ISO date is required.')
  .transform((v) => (v == null ? undefined : new Date(v)));

const optionalIntIdQuery = z.preprocess(
  (v) => (v == null || v === '' ? undefined : Number(v)),
  z.number().int().positive().optional(),
);

export const createExpenseSchema = z.object({
  vehicleId: z.number().int().positive().optional(),
  tripId: z.number().int().positive().optional(),
  category: z.string().trim().min(1, 'Category is required.').max(40),
  amount: z.number().min(0, 'Amount cannot be negative.'),
  expenseDate: isoDate,
  notes: z.string().max(255).optional(),
});

export const updateExpenseSchema = z.object({
  vehicleId: z.number().int().positive().nullable().optional(),
  tripId: z.number().int().positive().nullable().optional(),
  category: z.string().trim().min(1).max(40).optional(),
  amount: z.number().min(0).optional(),
  expenseDate: optionalDate,
  notes: z.string().max(255).optional(),
});

export const expenseQuerySchema = z.object({
  vehicleId: optionalIntIdQuery,
});
