import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import * as ctrl from './controller.js';

export const router = Router();

router.use(authenticate);

// Reports available to Fleet Manager and Financial Analyst.
router.use(requireRole('Fleet Manager', 'Financial Analyst'));

router.get('/operational-cost', ctrl.operationalCostCtrl);
router.get('/fuel-efficiency', ctrl.fuelEfficiencyCtrl);
router.get('/fleet-utilization', ctrl.fleetUtilizationCtrl);
router.get('/vehicle-roi', ctrl.vehicleRoiCtrl);
router.get('/export', ctrl.exportCtrl);
