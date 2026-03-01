import type { Analysis, DividendHistory, Period, Price, StockHistory } from './types';

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

export function getHistory(symbol: string, period: Period = '1y'): Promise<StockHistory> {
  return fetchApi(`/history/${encodeURIComponent(symbol)}?period=${period}`);
}

export function getAnalysis(symbol: string): Promise<Analysis> {
  return fetchApi(`/analysis/${encodeURIComponent(symbol)}`);
}

export function getPrice(symbol: string): Promise<Price> {
  return fetchApi(`/price/${encodeURIComponent(symbol)}`);
}

export function getDividends(symbol: string): Promise<DividendHistory> {
  return fetchApi(`/dividends/${encodeURIComponent(symbol)}`);
}

export function compareStocks(symbols: string[]): Promise<Analysis[]> {
  return fetchApi(`/compare?symbols=${symbols.map(encodeURIComponent).join(',')}`);
}
