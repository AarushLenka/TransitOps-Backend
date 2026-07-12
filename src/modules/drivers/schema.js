import { z } from 'zod';

const driverStatuses = ['AVAILABLE', 'ON_TRIP', 'OFF_DUTY', 'SUSPENDED'];

// Accepts ISO date strings (e.g. "2027-04-15") and coerces to a Date.
const licenseDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'A valid license expiry date is required.')
  .transform((v) => new Date(v));

export const createDriverSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  licenseNumber: z.string().trim().min(1).max(40),
  licenseCategory: z.string().trim().min(1).max(40),
  licenseExpiryDate: licenseDate,
  contactNumber: z.string().max(30).optional(),
  safetyScore: z.number().min(0).max(100).optional(),
});

export const updateDriverSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  licenseNumber: z.string().trim().min(1).max(40).optional(),
  licenseCategory: z.string().trim().min(1).max(40).optional(),
  licenseExpiryDate: licenseDate.optional(),
  contactNumber: z.string().max(30).optional(),
  safetyScore: z.number().min(0).max(100).optional(),
  status: z.enum(driverStatuses).optional(),
});

export const driverQuerySchema = z.object({
  status: z.enum(driverStatuses).optional(),
});
