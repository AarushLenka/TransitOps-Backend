import { z } from 'zod';

const tripStatuses = ['DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED'];

export const createTripSchema = z.object({
  source: z.string().trim().min(1).max(120),
  destination: z.string().trim().min(1).max(120),
  vehicleId: z.number().int().positive('vehicleId must be a positive integer.'),
  driverId: z.number().int().positive('driverId must be a positive integer.'),
  cargoWeight: z.number().min(0, 'Cargo weight cannot be negative.'),
  plannedDistance: z.number().positive('Planned distance must be a positive number.'),
  plannedRevenue: z.number().min(0).optional(),
});

export const completeTripSchema = z.object({
  finalOdometer: z.number().min(0).optional(),
  fuelConsumed: z.number().min(0).optional(),
  actualDistance: z.number().min(0).optional(),
  actualRevenue: z.number().min(0).optional(),
});

export const tripQuerySchema = z.object({
  status: z.enum(tripStatuses).optional(),
});
