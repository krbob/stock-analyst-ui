import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Interval } from './types';
import { useCompare, useQuote, useStockHistory, useTickerSearch } from './queries';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  keepPreviousData: vi.fn(),
  getHistory: vi.fn(),
  getQuote: vi.fn(),
  compareStocks: vi.fn(),
  searchTickers: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
  keepPreviousData: mocks.keepPreviousData,
}));

vi.mock('./client', () => ({
  getHistory: mocks.getHistory,
  getQuote: mocks.getQuote,
  compareStocks: mocks.compareStocks,
  searchTickers: mocks.searchTickers,
}));

interface QueryOptions {
  queryKey: unknown[];
  enabled: boolean;
  staleTime?: number;
  placeholderData?: unknown;
  queryFn: (context: { signal: AbortSignal }) => Promise<unknown>;
  refetchInterval?: () => number;
}

function lastOptions(offset = 1): QueryOptions {
  const call = mocks.useQuery.mock.calls.at(-offset);
  if (!call) throw new Error('useQuery was not called');
  return call[0] as QueryOptions;
}

function history(close = 100) {
  return {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    period: '1d',
    interval: '1m',
    adjustment: 'split-adjusted',
    prices: [
      { date: '2026-07-10', timestamp: 1, open: close, high: close, low: close, close, volume: 1, dividend: 0 },
    ],
    provenance: {
      source: 'YAHOO_FINANCE',
      retrievedAt: '2026-07-12T10:00:00Z',
      unitScale: 1,
      adjustment: 'SPLIT_ADJUSTED',
      status: 'FRESH',
    },
  };
}

function HistoryProbe({ symbol = ' aapl ', interval = '1m' }: { symbol?: string; interval?: Interval }) {
  useStockHistory(symbol, '1d', interval, ['sma50', 'sma50'], ' eur ', true);
  return null;
}

function OtherQueriesProbe({ enabled = true }: { enabled?: boolean }) {
  useQuote(enabled ? 'AAPL' : '', 'EUR');
  useCompare(enabled ? ['AAPL', 'MSFT'] : [], 'EUR');
  useTickerSearch(enabled ? 'micro' : '');
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useQuery.mockImplementation((options) => options);
});

afterEach(cleanup);

describe('query option contracts', () => {
  it('normalizes the history key and backs off unchanged intraday snapshots', async () => {
    mocks.getHistory.mockResolvedValue(history());
    const view = render(<HistoryProbe />);
    const options = lastOptions();
    const signal = new AbortController().signal;

    expect(options.queryKey).toEqual(['history', 'AAPL', '1d', '1m', 'sma50', 'EUR', true]);
    expect(options.enabled).toBe(true);
    expect(options.refetchInterval?.()).toBe(30_000);

    for (let request = 0; request < 4; request += 1) {
      await options.queryFn({ signal });
    }
    expect(mocks.getHistory).toHaveBeenLastCalledWith(
      'AAPL',
      '1d',
      '1m',
      ['sma50', 'sma50'],
      'EUR',
      true,
      signal,
    );
    expect(options.refetchInterval?.()).toBe(300_000);

    view.rerender(<HistoryProbe symbol="MSFT" />);
    expect(lastOptions().refetchInterval?.()).toBe(30_000);
  });

  it('wires quote, comparison and search keys, signals and disabled states', async () => {
    mocks.getQuote.mockResolvedValue({});
    mocks.compareStocks.mockResolvedValue([]);
    mocks.searchTickers.mockResolvedValue([]);
    const view = render(<OtherQueriesProbe />);
    const quote = lastOptions(3);
    const compare = lastOptions(2);
    const search = lastOptions(1);
    const signal = new AbortController().signal;

    expect(quote.queryKey).toEqual(['quote', 'AAPL', 'EUR']);
    expect(compare.queryKey).toEqual(['compare', 'AAPL', 'MSFT', 'EUR']);
    expect(search.queryKey).toEqual(['search', 'micro']);
    expect(search.staleTime).toBe(5 * 60 * 1000);
    expect(search.placeholderData).toBe(mocks.keepPreviousData);

    await quote.queryFn({ signal });
    await compare.queryFn({ signal });
    await search.queryFn({ signal });
    expect(mocks.getQuote).toHaveBeenCalledWith('AAPL', 'EUR', signal);
    expect(mocks.compareStocks).toHaveBeenCalledWith(['AAPL', 'MSFT'], 'EUR', signal);
    expect(mocks.searchTickers).toHaveBeenCalledWith('micro', signal);

    view.rerender(<OtherQueriesProbe enabled={false} />);
    expect(lastOptions(3).enabled).toBe(false);
    expect(lastOptions(2).enabled).toBe(false);
    expect(lastOptions(1).enabled).toBe(false);
  });
});
