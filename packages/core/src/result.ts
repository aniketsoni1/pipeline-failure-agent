/** A tiny Result type so connectors and tools never throw across boundaries. */
export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = AppError> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok;
}
export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return !r.ok;
}

/** Structured, serializable error. Never carries secret-bearing payloads. */
export interface AppError {
  code: AppErrorCode;
  message: string;
  /** Non-sensitive context (ids, hostnames, categories). */
  details?: Record<string, unknown>;
  retryable?: boolean;
}

export type AppErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_FAILED'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'CAPABILITY_UNSUPPORTED'
  | 'PERMISSION_DENIED'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL';

export function appError(
  code: AppErrorCode,
  message: string,
  details?: Record<string, unknown>,
  retryable = false,
): AppError {
  return { code, message, details, retryable };
}
