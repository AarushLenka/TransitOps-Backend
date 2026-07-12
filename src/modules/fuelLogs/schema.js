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

// Query params arrive as strings; coerce a present ?vehicleId= into a number.
const optionalIntIdQuery = z.preprocess(
  (v) => (v == null || v === '' ? undefined : Number(v)),
  z.number().int().positive().optional(),
);

export const createFuelLogSchema = z.object({
  vehicleId: z.number().int().positive('vehicleId must be a positive integer.'),
  tripId: z.number().int().positive().optional(),
  liters: z.number().positive('Liters must be a positive number.'),
  cost: z.number().min(0, 'Cost cannot be negative.'),
  logDate: isoDate,
  odometerAtFill: z.number().min(0).optional(),
});

export const updateFuelLogSchema = z.object({
  vehicleId: z.number().int().positive().optional(),
  tripId: z.number().int().positive().nullable().optional(),
  liters: z.number().positive().optional(),
  cost: z.number().min(0).optional(),
  logDate: optionalDate,
  odometerAtFill: z.number().min(0).optional(),
});

export const fuelLogQuerySchema = z.object({
  vehicleId: optionalIntIdQuery,
});
