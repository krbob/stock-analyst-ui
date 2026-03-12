import type { HistoricalPrice, HistoryRequest, Interval, Period, StockHistory } from './types';

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function normalizeCurrency(currency?: string): string | null {
  return currency?.trim().toUpperCase() ?? null;
}

export function buildIndicatorsKey(indicators?: string[]): string {
  if (!indicators || indicators.length === 0) return '';
  return [...new Set(indicators)].join(',');
}

export function createHistoryRequest(
  symbol: string,
  period: Period,
  interval?: Interval,
  indicators?: string[],
  currency?: string,
  dividends?: boolean,
): HistoryRequest {
  return {
    symbol: normalizeSymbol(symbol),
    period,
    interval,
    indicatorsKey: buildIndicatorsKey(indicators),
    currency: normalizeCurrency(currency),
    dividends: Boolean(dividends),
  };
}

export function attachHistoryRequest(history: StockHistory, request: HistoryRequest): StockHistory {
  return {
    ...history,
    request,
  };
}

export function matchesHistoryRequest(
  history: StockHistory | undefined,
  request: HistoryRequest,
): history is StockHistory {
  return history?.request?.symbol === request.symbol
    && history.request.period === request.period
    && history.request.interval === request.interval
    && history.request.indicatorsKey === request.indicatorsKey
    && history.request.currency === request.currency
    && history.request.dividends === request.dividends;
}

export function buildHistorySnapshotKey(prices: HistoricalPrice[]): string {
  const last = prices.at(-1);
  if (!last) return 'empty';

  return [
    prices.length,
    last.timestamp ?? last.date,
    last.open,
    last.high,
    last.low,
    last.close,
    last.volume,
    last.dividend,
  ].join(':');
}
