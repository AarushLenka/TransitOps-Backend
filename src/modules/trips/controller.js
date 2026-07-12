import { asyncHandler } from '../../utils/asyncHandler.js';
import * as svc from './service.js';

export const listCtrl = asyncHandler(async (req, res) => {
  res.json(await svc.list(req.query));
});

export const getCtrl = asyncHandler(async (req, res) => {
  res.json(await svc.getById(Number(req.params.id)));
});

export const createCtrl = asyncHandler(async (req, res) => {
  res.status(201).json(await svc.create(req.body, req.user?.id ?? null));
});

export const dispatchCtrl = asyncHandler(async (req, res) => {
  res.json(await svc.dispatch(Number(req.params.id)));
});

export const completeCtrl = asyncHandler(async (req, res) => {
  res.json(await svc.complete(Number(req.params.id), req.body));
});

export const cancelCtrl = asyncHandler(async (req, res) => {
  res.json(await svc.cancel(Number(req.params.id)));
});

export const removeCtrl = asyncHandler(async (req, res) => {
  await svc.remove(Number(req.params.id));
  res.status(204).end();
});
