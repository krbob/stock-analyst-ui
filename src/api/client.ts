import type { CompareResult, Interval, Period, Quote, SearchResult, StockHistory } from './types';
import { attachHistoryRequest, createHistoryRequest } from './history-utils';
import { ApiError, parseRetryAfterSeconds } from './errors';

const API_URL = '/api';

async function fetchApi<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = signal
    ? await fetch(`${API_URL}${path}`, { signal })
    : await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    const text = await response.text();
    let message = `${response.status} ${response.statusText}`;
    try {
      const json = JSON.parse(text);
      if (json.error) message = json.error;
    } catch {
      if (text && !text.trimStart().startsWith('<')) message = text;
    }
    const retryAfterSeconds = parseRetryAfterSeconds(response.headers?.get?.('Retry-After'));
    if (response.status === 429 && retryAfterSeconds != null) {
      message += ` Try again in ${retryAfterSeconds} seconds.`;
    }
    throw new ApiError(message, response.status, retryAfterSeconds);
  }
  return response.json();
}

export function getHistory(symbol: string, period: Period = '1y', interval?: Interval, indicators?: string[], currency?: string, dividends?: boolean, signal?: AbortSignal): Promise<StockHistory> {
  const request = createHistoryRequest(symbol, period, interval, indicators, currency, dividends);
  let url = `/history/${encodeURIComponent(request.symbol)}?period=${request.period}`;
  if (request.interval) url += `&interval=${request.interval}`;
  if (request.indicatorsKey) url += `&indicators=${request.indicatorsKey}`;
  if (request.currency) url += `&currency=${encodeURIComponent(request.currency)}`;
  if (request.dividends) url += '&dividends=true';

  return fetchApi<StockHistory>(url, signal).then((history) => attachHistoryRequest(history, request));
}

export function getQuote(symbol: string, currency?: string, signal?: AbortSignal): Promise<Quote> {
  let url = `/quote/${encodeURIComponent(symbol)}`;
  if (currency) url += `?currency=${encodeURIComponent(currency)}`;
  return fetchApi(url, signal);
}

export function compareStocks(symbols: string[], currency?: string, signal?: AbortSignal): Promise<CompareResult[]> {
  let url = `/compare?symbols=${symbols.map(encodeURIComponent).join(',')}`;
  if (currency) url += `&currency=${encodeURIComponent(currency)}`;
  return fetchApi(url, signal);
}

export function searchTickers(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  return fetchApi(`/search/${encodeURIComponent(query)}`, signal);
}
