import { z } from 'zod';

// Dashboard KPIs aggregate by status, so a status filter is intentionally NOT
// accepted here (it would collapse the status breakdown). Scope the fleet by
// type and/or region instead.
export const dashboardQuerySchema = z.object({
  type: z.string().optional(),
  region: z.string().optional(),
});
