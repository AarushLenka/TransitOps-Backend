import { z } from 'zod';

const maintenanceStatuses = ['OPEN', 'IN_PROGRESS', 'CLOSED'];

// Accepts an ISO date string or null/absent; coerces a present value to a Date.
const optionalDate = z
  .union([z.string(), z.null()])
  .optional()
  .refine((v) => v == null || (typeof v === 'string' && !Number.isNaN(Date.parse(v))), 'A valid ISO date is required.')
  .transform((v) => (v == null ? undefined : new Date(v)));

export const createMaintenanceSchema = z.object({
  vehicleId: z.number().int().positive('vehicleId must be a positive integer.'),
  serviceType: z.string().trim().min(1).max(80),
  description: z.string().max(255).optional(),
  cost: z.number().min(0).optional(),
  startDate: optionalDate,
  notes: z.string().optional(),
});

export const updateMaintenanceSchema = z.object({
  serviceType: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(255).optional(),
  cost: z.number().min(0).optional(),
  status: z.enum(maintenanceStatuses).optional(),
  endDate: optionalDate,
  notes: z.string().optional(),
});
