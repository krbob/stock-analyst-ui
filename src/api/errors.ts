import type {
  ApiError as ContractApiError,
  ApiErrorCode,
} from './generated/types.gen';

export class ApiError extends Error {
  readonly status: number;
  readonly retryAfterSeconds: number | null;
  readonly errorCode: ApiErrorCode | null;
  readonly retryable: boolean;
  readonly requestId: string | null;
  readonly body: ContractApiError | null;

  constructor(
    message: string,
    status: number,
    retryAfterSeconds: number | null = null,
    body: ContractApiError | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.errorCode = body?.errorCode ?? null;
    this.retryable = body?.retryable ?? status >= 500;
    this.requestId = body?.requestId ?? null;
    this.body = body;
  }
}

export function parseRetryAfterSeconds(
  value: string | null | undefined,
  nowMillis: number = Date.now(),
): number | null {
  if (value == null || value.trim() === '') return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return seconds >= 0 ? Math.ceil(seconds) : null;
  }

  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return null;
  return Math.max(0, Math.ceil((retryAt - nowMillis) / 1_000));
}

export function shouldRetryApiQuery(failureCount: number, error: Error): boolean {
  if (failureCount >= 1) return false;
  if (error instanceof ApiError) return error.status !== 429 && error.status >= 500 && error.retryable;
  return true;
}
