import { ErrorCode, type ApiError } from '@sportswear/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(HttpError.notFound('Endpoint tidak ditemukan'));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let body: ApiError = {
    error: { code: ErrorCode.INTERNAL_ERROR, message: 'Terjadi kesalahan pada server' },
  };

  if (err instanceof HttpError) {
    status = err.status;
    body = { error: { code: err.code, message: err.message } };
  } else if (err instanceof ZodError) {
    status = 400;
    const first = err.issues[0];
    const message = first
      ? `${first.path.join('.') || 'input'}: ${first.message}`
      : 'Input tidak valid';
    body = { error: { code: ErrorCode.VALIDATION_ERROR, message } };
  } else if (isBodyParserError(err)) {
    status = err.status;
    body = { error: { code: ErrorCode.VALIDATION_ERROR, message: 'Body request tidak valid' } };
  }

  if (status >= 500) {
    logger.error({ err, method: req.method, url: req.originalUrl }, 'Unhandled error');
  }

  res.status(status).json(body);
};

function isBodyParserError(err: unknown): err is { status: number; type: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    'status' in err &&
    typeof err.status === 'number' &&
    err.status >= 400 &&
    err.status < 500
  );
}
