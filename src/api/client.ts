import { client as generatedClient } from './generated/client.gen';
import {
  compareStocks as requestComparison,
  getQuote as requestQuote,
  getStockHistory as requestHistory,
  searchTickers as requestSearch,
} from './generated/sdk.gen';
import type { ApiError as ContractApiError } from './generated/types.gen';
import type { CompareResult, Interval, Period, Quote, SearchResult, StockHistory } from './types';
import { attachHistoryRequest, createHistoryRequest } from './history-utils';
import { ApiError, parseRetryAfterSeconds } from './errors';

const API_URL = new URL('/api', window.location.origin).toString().replace(/\/$/, '');

generatedClient.setConfig({ baseUrl: API_URL });

interface GeneratedResult<T> {
  data?: T;
  error?: unknown;
  response?: Response;
}

function contractError(value: unknown): ContractApiError | null {
  if (value == null || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.error !== 'string'
    || typeof candidate.errorCode !== 'string'
    || typeof candidate.retryable !== 'boolean'
    || !(candidate.requestId == null || typeof candidate.requestId === 'string')
  ) return null;
  return candidate as ContractApiError;
}

function errorText(value: unknown): string | null {
  if (typeof value === 'string') {
    return value && !value.trimStart().startsWith('<') ? value : null;
  }
  if (value != null && typeof value === 'object') {
    const error = (value as Record<string, unknown>).error;
    if (typeof error === 'string' && error) return error;
  }
  return null;
}

function hasJsonMediaType(response: Response): boolean {
  const mediaType = response.headers.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase();
  return mediaType === 'application/json' || Boolean(mediaType?.endsWith('+json'));
}

function unwrapResult<T>({ data, error, response }: GeneratedResult<T>): T {
  if (data !== undefined) {
    // Generated clients trust a successful response shape. A proxy can still
    // return the SPA's HTML with 200, which must never reach typed UI state.
    if (response && !hasJsonMediaType(response)) {
      throw new ApiError('API returned an unexpected non-JSON response.', 502);
    }
    return data;
  }

  // Fetch/network failures have no HTTP response. Keep the original Error so
  // React Query can distinguish transport failures from classified API errors.
  if (!response) {
    if (error instanceof Error) throw error;
    throw new Error(errorText(error) ?? 'Network request failed');
  }

  const body = contractError(error);
  const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('Retry-After'));
  let message = body?.error ?? errorText(error) ?? `${response.status} ${response.statusText}`;
  if (response.status === 429 && retryAfterSeconds != null) {
    message += ` Try again in ${retryAfterSeconds} seconds.`;
  }
  throw new ApiError(message, response.status, retryAfterSeconds, body);
}

export async function getHistory(
  symbol: string,
  period: Period = '1y',
  interval?: Interval,
  indicators?: string[],
  currency?: string,
  dividends?: boolean,
  signal?: AbortSignal,
): Promise<StockHistory> {
  const request = createHistoryRequest(symbol, period, interval, indicators, currency, dividends);
  const result = await requestHistory({
    path: { stock: request.symbol },
    query: {
      period: request.period,
      interval: request.interval,
      indicators: request.indicatorsKey || undefined,
      currency: request.currency ?? undefined,
      dividends: request.dividends || undefined,
    },
    signal,
  });
  return attachHistoryRequest(unwrapResult(result), request);
}

export async function getQuote(symbol: string, currency?: string, signal?: AbortSignal): Promise<Quote> {
  const result = await requestQuote({
    path: { stock: symbol },
    query: { currency },
    signal,
  });
  return unwrapResult(result);
}

export async function compareStocks(symbols: string[], currency?: string, signal?: AbortSignal): Promise<CompareResult[]> {
  const result = await requestComparison({
    query: { symbols, currency },
    signal,
  });
  return unwrapResult(result);
}

export async function searchTickers(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const result = await requestSearch({
    path: { query },
    signal,
  });
  return unwrapResult(result);
}
