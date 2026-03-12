import type { CompareResult, Interval, Period, Quote, SearchResult, StockHistory } from './types';
import { attachHistoryRequest, createHistoryRequest } from './history-utils';

const API_URL = '/api';

async function fetchApi<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    const text = await response.text();
    let message = `${response.status} ${response.statusText}`;
    try {
      const json = JSON.parse(text);
      if (json.error) message = json.error;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }
  return response.json();
}

export function getHistory(symbol: string, period: Period = '1y', interval?: Interval, indicators?: string[], currency?: string, dividends?: boolean): Promise<StockHistory> {
  const request = createHistoryRequest(symbol, period, interval, indicators, currency, dividends);
  let url = `/history/${encodeURIComponent(request.symbol)}?period=${request.period}`;
  if (request.interval) url += `&interval=${request.interval}`;
  if (request.indicatorsKey) url += `&indicators=${request.indicatorsKey}`;
  if (request.currency) url += `&currency=${encodeURIComponent(request.currency)}`;
  if (request.dividends) url += '&dividends=true';

  return fetchApi<StockHistory>(url).then((history) => attachHistoryRequest(history, request));
}

export function getQuote(symbol: string, currency?: string): Promise<Quote> {
  let url = `/quote/${encodeURIComponent(symbol)}`;
  if (currency) url += `?currency=${encodeURIComponent(currency)}`;
  return fetchApi(url);
}

export function compareStocks(symbols: string[], currency?: string): Promise<CompareResult[]> {
  let url = `/compare?symbols=${symbols.map(encodeURIComponent).join(',')}`;
  if (currency) url += `&currency=${encodeURIComponent(currency)}`;
  return fetchApi(url);
}

export function searchTickers(query: string): Promise<SearchResult[]> {
  return fetchApi(`/search/${encodeURIComponent(query)}`);
}
