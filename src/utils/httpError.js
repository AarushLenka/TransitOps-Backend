// Throw HttpError(statusCode, code, message, details?) from any service.
// The central error handler turns it into a consistent JSON error body.
export class HttpError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isHttpError = true;
  }
}
