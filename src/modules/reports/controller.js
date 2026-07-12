import { asyncHandler } from '../../utils/asyncHandler.js';
import { HttpError } from '../../utils/httpError.js';
import * as svc from './service.js';
import { cachedGet, KEYS, TTL } from '../../lib/cache.js';

// Reports are per-vehicle groupBy aggregates — the heaviest reads in the API.
// Each lives under its own cache key; any write to the source tables (vehicles,
// trips, maintenance, fuel, expenses) busts the whole reports namespace.
export const operationalCostCtrl = asyncHandler(async (_req, res) => {
  res.json(await cachedGet(KEYS.reports('operational-cost'), () => svc.operationalCost(), TTL.reports));
});

export const fuelEfficiencyCtrl = asyncHandler(async (_req, res) => {
  res.json(await cachedGet(KEYS.reports('fuel-efficiency'), () => svc.fuelEfficiency(), TTL.reports));
});

export const fleetUtilizationCtrl = asyncHandler(async (_req, res) => {
  res.json(await cachedGet(KEYS.reports('fleet-utilization'), () => svc.fleetUtilization(), TTL.reports));
});

export const vehicleRoiCtrl = asyncHandler(async (_req, res) => {
  res.json(await cachedGet(KEYS.reports('vehicle-roi'), () => svc.vehicleRoi(), TTL.reports));
});

export const exportCtrl = asyncHandler(async (req, res) => {
  const format = req.query.format || 'csv';
  if (format !== 'csv') {
    throw new HttpError(400, 'UNSUPPORTED_FORMAT', 'Only CSV export is supported (PDF export is a bonus feature).');
  }
  const csv = await cachedGet(KEYS.reports('export:csv'), () => svc.operationalCostCsv(), TTL.reports);
  res.header('Content-Type', 'text/csv');
  res.attachment('transitops-operational-cost.csv');
  res.send(csv);
});
