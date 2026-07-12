// Central error handler. Mounted last. Normalises HttpError + Prisma errors
// into { error: { code, message, details? } }.
import { Prisma } from '@prisma/client';

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong.';
  let details = err.details;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {            // unique constraint violation
      status = 409;
      code = 'DUPLICATE_VALUE';
      const target = err.meta?.target?.join(', ');
      message = `A record with that ${target || 'value'} already exists.`;
    } else if (err.code === 'P2025') {     // record not found (update/delete)
      status = 404;
      code = 'NOT_FOUND';
      message = 'Record not found.';
    } else {
      status = 400;
      code = `PRISMA_${err.code}`;
      message = err.message;
    }
  }

  if (status >= 500) {
    console.error('[error]', err);
  }
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}
