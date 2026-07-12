import { asyncHandler } from '../../utils/asyncHandler.js';
import * as svc from './service.js';
import { cachedGet, KEYS, TTL, invalidateDrivers } from '../../lib/cache.js';

// Reads cached by query filter (list) and by id (detail). Writes bust only the
// driver namespace: drivers feed the dashboard's driversOnDuty count, and a
// manual write can never set status=ON_TRIP (the service forbids it), so the
// dashboard count is unaffected by driver CRUD. No report depends on drivers.
export const listCtrl = asyncHandler(async (req, res) => {
  res.json(await cachedGet(KEYS.driversList(req.query), () => svc.list(req.query), TTL.drivers));
});

export const getCtrl = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  res.json(await cachedGet(KEYS.driver(id), () => svc.getById(id), TTL.drivers));
});

export const createCtrl = asyncHandler(async (req, res) => {
  const driver = await svc.create(req.body);
  await invalidateDrivers();
  res.status(201).json(driver);
});

export const updateCtrl = asyncHandler(async (req, res) => {
  const driver = await svc.update(Number(req.params.id), req.body);
  await invalidateDrivers();
  res.json(driver);
});

export const removeCtrl = asyncHandler(async (req, res, next) => {
  await svc.remove(Number(req.params.id));
  await invalidateDrivers();
  res.status(204).end();
});
