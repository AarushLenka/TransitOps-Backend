import { asyncHandler } from '../../utils/asyncHandler.js';
import * as svc from './service.js';
import { cachedGet, KEYS, TTL, invalidateVehicles, invalidateAnalytics } from '../../lib/cache.js';

// Reads cached by query filters (list) and by id (detail). Writes bust the
// vehicle namespace (list + all details) and the analytics namespace (a vehicle
// appears in dashboard counts and every report's vehicle list).
export const listCtrl = asyncHandler(async (req, res) => {
  res.json(await cachedGet(KEYS.vehiclesList(req.query), () => svc.list(req.query), TTL.vehicles));
});

export const getCtrl = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  res.json(await cachedGet(KEYS.vehicle(id), () => svc.getById(id), TTL.vehicles));
});

export const createCtrl = asyncHandler(async (req, res) => {
  const vehicle = await svc.create(req.body);
  await Promise.all([invalidateVehicles(), invalidateAnalytics()]);
  res.status(201).json(vehicle);
});

export const updateCtrl = asyncHandler(async (req, res) => {
  const vehicle = await svc.update(Number(req.params.id), req.body);
  await Promise.all([invalidateVehicles(), invalidateAnalytics()]);
  res.json(vehicle);
});

export const removeCtrl = asyncHandler(async (req, res, next) => {
  await svc.remove(Number(req.params.id));
  await Promise.all([invalidateVehicles(), invalidateAnalytics()]);
  res.status(204).end();
});
