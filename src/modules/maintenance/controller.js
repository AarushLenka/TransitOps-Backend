import { asyncHandler } from '../../utils/asyncHandler.js';
import * as svc from './service.js';
import { invalidateVehicles, invalidateAnalytics } from '../../lib/cache.js';

// Maintenance reads are NOT cached (payload `include`s the vehicle). Writes bust
// the vehicle namespace (open -> vehicle IN_SHOP, close -> AVAILABLE) and the
// analytics namespace (maintenance cost feeds the operational-cost + vehicle-ROI
// reports; vehicle status feeds dashboard counts).
export const listCtrl = asyncHandler(async (_req, res) => {
  res.json(await svc.list());
});

export const getCtrl = asyncHandler(async (req, res) => {
  res.json(await svc.getById(Number(req.params.id)));
});

export const createCtrl = asyncHandler(async (req, res) => {
  const log = await svc.create(req.body);
  await Promise.all([invalidateVehicles(), invalidateAnalytics()]);
  res.status(201).json(log);
});

export const updateCtrl = asyncHandler(async (req, res) => {
  const log = await svc.update(Number(req.params.id), req.body);
  await Promise.all([invalidateVehicles(), invalidateAnalytics()]);
  res.json(log);
});

export const removeCtrl = asyncHandler(async (req, res, next) => {
  await svc.remove(Number(req.params.id));
  await Promise.all([invalidateVehicles(), invalidateAnalytics()]);
  res.status(204).end();
});
