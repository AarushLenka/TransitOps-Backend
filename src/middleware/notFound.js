import { HttpError } from '../utils/httpError.js';

export function notFound(req, _res, next) {
  next(new HttpError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found.`));
}
