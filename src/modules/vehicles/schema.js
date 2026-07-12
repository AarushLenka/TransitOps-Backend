import { z } from 'zod';

const vehicleStatuses = ['AVAILABLE', 'ON_TRIP', 'IN_SHOP', 'RETIRED'];

export const createVehicleSchema = z.object({
  registrationNumber: z.string().trim().min(1).max(30),
  model: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(40),
  maxLoadCapacity: z.number().positive('Max load capacity must be a positive number.'),
  odometer: z.number().min(0).optional(),
  acquisitionCost: z.number().min(0, 'Acquisition cost cannot be negative.'),
  region: z.string().max(80).optional(),
});

export const updateVehicleSchema = z.object({
  registrationNumber: z.string().trim().min(1).max(30).optional(),
  model: z.string().trim().min(1).max(120).optional(),
  type: z.string().trim().min(1).max(40).optional(),
  maxLoadCapacity: z.number().positive().optional(),
  odometer: z.number().min(0).optional(),
  acquisitionCost: z.number().min(0).optional(),
  region: z.string().max(80).optional(),
  status: z.enum(vehicleStatuses).optional(),
});

export const vehicleQuerySchema = z.object({
  status: z.enum(vehicleStatuses).optional(),
  type: z.string().optional(),
  region: z.string().optional(),
});
