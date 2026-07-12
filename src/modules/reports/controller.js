import { asyncHandler } from '../../utils/asyncHandler.js';
import { HttpError } from '../../utils/httpError.js';
import * as svc from './service.js';

export const operationalCostCtrl = asyncHandler(async (_req, res) => {
  res.json(await svc.operationalCost());
});

export const fuelEfficiencyCtrl = asyncHandler(async (_req, res) => {
  res.json(await svc.fuelEfficiency());
});

export const fleetUtilizationCtrl = asyncHandler(async (_req, res) => {
  res.json(await svc.fleetUtilization());
});

export const vehicleRoiCtrl = asyncHandler(async (_req, res) => {
  res.json(await svc.vehicleRoi());
});

export const exportCtrl = asyncHandler(async (req, res) => {
  const format = req.query.format || 'csv';
  if (format !== 'csv') {
    throw new HttpError(400, 'UNSUPPORTED_FORMAT', 'Only CSV export is supported (PDF export is a bonus feature).');
  }
  const csv = await svc.operationalCostCsv();
  res.header('Content-Type', 'text/csv');
  res.attachment('transitops-operational-cost.csv');
  res.send(csv);
});
