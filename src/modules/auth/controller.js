import { asyncHandler } from '../../utils/asyncHandler.js';
import { register, login, me } from './service.js';

export const registerCtrl = asyncHandler(async (req, res) => {
  const { token, user } = await register(req.body);
  res.status(201).json({ token, user });
});

export const loginCtrl = asyncHandler(async (req, res) => {
  const { token, user } = await login(req.body);
  res.json({ token, user });
});

export const meCtrl = asyncHandler(async (req, res) => {
  const user = await me(req.user.id);
  res.json({ user });
});
