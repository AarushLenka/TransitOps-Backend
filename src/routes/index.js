// Mounts every domain module under /api.
import { Router } from 'express';
import { router as authRouter } from '../modules/auth/routes.js';
import { router as vehiclesRouter } from '../modules/vehicles/routes.js';
import { router as driversRouter } from '../modules/drivers/routes.js';
import { router as tripsRouter } from '../modules/trips/routes.js';
import { router as maintenanceRouter } from '../modules/maintenance/routes.js';
import { router as fuelLogsRouter } from '../modules/fuelLogs/routes.js';
import { router as expensesRouter } from '../modules/expenses/routes.js';
import { router as dashboardRouter } from '../modules/dashboard/routes.js';
import { router as reportsRouter } from '../modules/reports/routes.js';

export const router = Router();

router.use('/auth', authRouter);
router.use('/vehicles', vehiclesRouter);
router.use('/drivers', driversRouter);
router.use('/trips', tripsRouter);
router.use('/maintenance', maintenanceRouter);
router.use('/fuel-logs', fuelLogsRouter);
router.use('/expenses', expensesRouter);
router.use('/dashboard', dashboardRouter);
router.use('/reports', reportsRouter);
