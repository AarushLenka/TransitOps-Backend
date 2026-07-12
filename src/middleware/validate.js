// validate(schema, 'body' | 'query' | 'params')
// On failure throws a 400 VALIDATION_ERROR with a details array (one per issue).
// On success, replaces req[location] with the parsed/coerced value.
import { HttpError } from '../utils/httpError.js';

export function validate(schema, location = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[location]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join('.') || '(root)',
        message: i.message,
      }));
      return next(new HttpError(400, 'VALIDATION_ERROR', 'Request validation failed.', details));
    }
    req[location] = result.data;
    next();
  };
}
