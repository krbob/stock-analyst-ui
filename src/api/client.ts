import type { Analysis, Interval, Period, Price, SearchResult, StockHistory } from './types';

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
  let url = `/history/${encodeURIComponent(symbol)}?period=${period}`;
  if (interval) url += `&interval=${interval}`;
  if (indicators && indicators.length > 0) url += `&indicators=${indicators.join(',')}`;
  if (currency) url += `&currency=${encodeURIComponent(currency)}`;
  if (dividends) url += '&dividends=true';
  return fetchApi(url);
}

export function getAnalysis(symbol: string, currency?: string): Promise<Analysis> {
  let url = `/analysis/${encodeURIComponent(symbol)}`;
  if (currency) url += `?currency=${encodeURIComponent(currency)}`;
  return fetchApi(url);
}

export function getPrice(symbol: string, currency?: string): Promise<Price> {
  let url = `/price/${encodeURIComponent(symbol)}`;
  if (currency) url += `?currency=${encodeURIComponent(currency)}`;
  return fetchApi(url);
}

export function compareStocks(symbols: string[]): Promise<Analysis[]> {
  return fetchApi(`/compare?symbols=${symbols.map(encodeURIComponent).join(',')}`);
}

export function searchTickers(query: string): Promise<SearchResult[]> {
  return fetchApi(`/search/${encodeURIComponent(query)}`);
}
