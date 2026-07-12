// Wraps an async route handler so promise rejections flow to next(),
// i.e. into the central error handler — no try/catch boilerplate in controllers.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
