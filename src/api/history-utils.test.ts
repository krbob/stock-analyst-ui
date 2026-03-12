import { describe, expect, it } from 'vitest';
import { buildHistorySnapshotKey, createHistoryRequest, matchesHistoryRequest } from './history-utils';
import type { StockHistory } from './types';

describe('createHistoryRequest', () => {
  it('normalizes symbol and currency while deduplicating indicators', () => {
    expect(createHistoryRequest(' aapl ', '1y', '1d', ['sma50', 'sma50', 'rsi'], ' eur ', true)).toEqual({
      symbol: 'AAPL',
      period: '1y',
      interval: '1d',
      indicatorsKey: 'sma50,rsi',
      currency: 'EUR',
      dividends: true,
    });
  });
});

describe('matchesHistoryRequest', () => {
  const baseHistory: StockHistory = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    period: '1y',
    interval: '1d',
    prices: [],
    request: createHistoryRequest('AAPL', '1y', '1d', ['sma50'], 'EUR', true),
  };

  it('matches the exact request metadata', () => {
    expect(matchesHistoryRequest(baseHistory, createHistoryRequest('AAPL', '1y', '1d', ['sma50'], 'EUR', true))).toBe(true);
  });

  it('rejects stale data from a different symbol', () => {
    expect(matchesHistoryRequest(baseHistory, createHistoryRequest('MSFT', '1y', '1d', ['sma50'], 'EUR', true))).toBe(false);
  });

  it('rejects stale data from a different currency request', () => {
    expect(matchesHistoryRequest(baseHistory, createHistoryRequest('AAPL', '1y', '1d', ['sma50'], 'USD', true))).toBe(false);
  });

  it('rejects stale data from a different period request', () => {
    expect(matchesHistoryRequest(baseHistory, createHistoryRequest('AAPL', '5y', '1d', ['sma50'], 'EUR', true))).toBe(false);
  });
});

describe('buildHistorySnapshotKey', () => {
  it('returns empty for missing prices', () => {
    expect(buildHistorySnapshotKey([])).toBe('empty');
  });

  it('changes when the last candle content changes', () => {
    const first = buildHistorySnapshotKey([
      { date: '2025-01-01', open: 100, high: 110, low: 95, close: 105, volume: 1000, dividend: 0, timestamp: 1 },
    ]);
    const second = buildHistorySnapshotKey([
      { date: '2025-01-01', open: 100, high: 110, low: 95, close: 106, volume: 1000, dividend: 0, timestamp: 1 },
    ]);

    expect(second).not.toBe(first);
  });

  it('changes when a new candle is appended even if the last values repeat later', () => {
    const first = buildHistorySnapshotKey([
      { date: '2025-01-01', open: 100, high: 110, low: 95, close: 105, volume: 1000, dividend: 0, timestamp: 1 },
    ]);
    const second = buildHistorySnapshotKey([
      { date: '2025-01-01', open: 100, high: 110, low: 95, close: 105, volume: 1000, dividend: 0, timestamp: 1 },
      { date: '2025-01-02', open: 105, high: 112, low: 101, close: 105, volume: 1000, dividend: 0, timestamp: 2 },
    ]);

    expect(second).not.toBe(first);
  });
});
