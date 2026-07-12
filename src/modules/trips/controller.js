import { asyncHandler } from '../../utils/asyncHandler.js';
import * as svc from './service.js';
import { invalidateVehicles, invalidateDrivers, invalidateAnalytics } from '../../lib/cache.js';

// Trip reads are NOT cached: their payload `include`s vehicle + driver rows, so a
// status flip would stale-date any cached copy. But trip writes invalidate the
// caches that DO depend on them:
//  - create / remove -> dashboard trip counts (DRAFT / DISPATCHED) only.
//  - dispatch / complete / cancel -> also flip vehicle + driver status, so those
//    namespaces are busted too, plus reports (fleet utilisation, fuel efficiency,
//    vehicle ROI all read trip aggregates).
export const listCtrl = asyncHandler(async (req, res) => {
  res.json(await svc.list(req.query));
});

export const getCtrl = asyncHandler(async (req, res) => {
  res.json(await svc.getById(Number(req.params.id)));
});

export const createCtrl = asyncHandler(async (req, res) => {
  const trip = await svc.create(req.body, req.user?.id ?? null);
  await invalidateAnalytics();
  res.status(201).json(trip);
});

export const dispatchCtrl = asyncHandler(async (req, res) => {
  const trip = await svc.dispatch(Number(req.params.id));
  await Promise.all([invalidateVehicles(), invalidateDrivers(), invalidateAnalytics()]);
  res.json(trip);
});

export const completeCtrl = asyncHandler(async (req, res) => {
  const trip = await svc.complete(Number(req.params.id), req.body);
  await Promise.all([invalidateVehicles(), invalidateDrivers(), invalidateAnalytics()]);
  res.json(trip);
});

export const cancelCtrl = asyncHandler(async (req, res) => {
  const trip = await svc.cancel(Number(req.params.id));
  await Promise.all([invalidateVehicles(), invalidateDrivers(), invalidateAnalytics()]);
  res.json(trip);
});

export const removeCtrl = asyncHandler(async (req, res, next) => {
  await svc.remove(Number(req.params.id));
  await invalidateAnalytics();
  res.status(204).end();
});
