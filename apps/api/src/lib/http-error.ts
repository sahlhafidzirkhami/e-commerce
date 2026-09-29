import { ErrorCode } from '@sportswear/shared';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode | (string & {}),
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message: string, code: string = ErrorCode.VALIDATION_ERROR) {
    return new HttpError(400, code, message);
  }

  static unauthorized(message = 'Silakan login terlebih dahulu') {
    return new HttpError(401, ErrorCode.UNAUTHORIZED, message);
  }

  static forbidden(message = 'Anda tidak memiliki akses') {
    return new HttpError(403, ErrorCode.FORBIDDEN, message);
  }

  static notFound(message = 'Data tidak ditemukan') {
    return new HttpError(404, ErrorCode.NOT_FOUND, message);
  }

  static conflict(message: string, code: string = ErrorCode.CONFLICT) {
    return new HttpError(409, code, message);
  }
}
