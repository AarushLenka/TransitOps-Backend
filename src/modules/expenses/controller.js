import { asyncHandler } from '../../utils/asyncHandler.js';
import * as svc from './service.js';
import { invalidateAnalytics } from '../../lib/cache.js';

// Expense reads are NOT cached (payload `include`s vehicle + trip). Writes touch
// no vehicle/driver row, so they only bust the analytics namespace: expense amounts
// feed the operational-cost report.
export const listCtrl = asyncHandler(async (req, res) => res.json(await svc.list(req.query)));
export const getCtrl = asyncHandler(async (req, res) => res.json(await svc.getById(Number(req.params.id))));

export const createCtrl = asyncHandler(async (req, res) => {
  const log = await svc.create(req.body);
  await invalidateAnalytics();
  res.status(201).json(log);
});

export const updateCtrl = asyncHandler(async (req, res) => {
  const log = await svc.update(Number(req.params.id), req.body);
  await invalidateAnalytics();
  res.json(log);
});

export const removeCtrl = asyncHandler(async (req, res) => {
  await svc.remove(Number(req.params.id));
  await invalidateAnalytics();
  res.status(204).end();
});
