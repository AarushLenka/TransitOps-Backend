// requireRole('Fleet Manager', 'Driver', ...) — 403 if the authenticated user's
// role is not in the allowed list.
import { HttpError } from '../utils/httpError.js';

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role?.name;
    if (!userRole) {
      return next(new HttpError(403, 'FORBIDDEN', 'No role associated with authenticated user.'));
    }
    if (!allowedRoles.includes(userRole)) {
      return next(new HttpError(403, 'FORBIDDEN', `This action requires one of: ${allowedRoles.join(', ')}.`));
    }
    next();
  };
}
