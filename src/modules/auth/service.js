import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/httpError.js';
import { config } from '../../config/env.js';

function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role?.name ?? null },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

function sanitize(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    roleId: user.roleId,
    role: user.role?.name ?? null,
    region: user.region,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export async function register({ fullName, email, password, roleId, region }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, 'EMAIL_TAKEN', 'A user with that email already exists.');

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new HttpError(404, 'ROLE_NOT_FOUND', `Role ${roleId} does not exist.`);

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { fullName, email, passwordHash, roleId, region },
    include: { role: true },
  });
  return { token: signToken(user), user: sanitize(user) };
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
  if (!user) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  if (!user.isActive) throw new HttpError(403, 'ACCOUNT_DISABLED', 'This account has been disabled.');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  return { token: signToken(user), user: sanitize(user) };
}

export async function me(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!user) throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  return sanitize(user);
}
