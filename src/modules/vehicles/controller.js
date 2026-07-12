import { asyncHandler } from '../../utils/asyncHandler.js';
import * as svc from './service.js';

export const listCtrl = asyncHandler(async (req, res) => {
  res.json(await svc.list(req.query));
});

export const getCtrl = asyncHandler(async (req, res) => {
  res.json(await svc.getById(Number(req.params.id)));
});

export const createCtrl = asyncHandler(async (req, res) => {
  res.status(201).json(await svc.create(req.body));
});

export const updateCtrl = asyncHandler(async (req, res) => {
  res.json(await svc.update(Number(req.params.id), req.body));
});

export const removeCtrl = asyncHandler(async (req, res, next) => {
  await svc.remove(Number(req.params.id));
  res.status(204).end();
});
