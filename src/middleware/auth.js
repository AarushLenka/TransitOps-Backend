// authenticate middleware: verifies Bearer token, loads the user (+role), sets req.user.
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/httpError.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Missing Authorization header. Expected: Bearer <token>.');
    }
    const token = header.slice(7).trim();
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw new HttpError(401, 'INVALID_TOKEN', 'Token is invalid or expired.');
    }
    const user = await prisma.user.findUnique({
      where: { id: Number(payload.sub) },
      include: { role: true },
    });
    if (!user || !user.isActive) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'User does not exist or is disabled.');
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
