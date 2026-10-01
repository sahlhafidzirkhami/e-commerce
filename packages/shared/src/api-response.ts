export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  PRODUCT_UNAVAILABLE: 'PRODUCT_UNAVAILABLE',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: ErrorCode | (string & {});
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
