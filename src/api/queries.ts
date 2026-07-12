import { useEffect, useRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getHistory, getQuote, compareStocks, searchTickers } from './client';
import type { Interval, Period } from './types';
import { INTRADAY_INTERVALS } from './types';
import { buildHistorySnapshotKey, createHistoryRequest } from './history-utils';

export function useStockHistory(symbol: string, period: Period = '1y', interval?: Interval, indicators?: string[], currency?: string, dividends?: boolean) {
  const request = createHistoryRequest(symbol, period, interval, indicators, currency, dividends);
  const requestedIndicators = request.indicatorsKey ? request.indicatorsKey.split(',') : undefined;
  const intraday = interval != null && INTRADAY_INTERVALS.includes(interval);
  const staleCountRef = useRef(0);
  const prevSnapshotRef = useRef('');

  useEffect(() => {
    staleCountRef.current = 0;
    prevSnapshotRef.current = '';
  }, [request.symbol, request.period, request.interval, request.currency, request.dividends, request.indicatorsKey]);

  return useQuery({
    queryKey: ['history', request.symbol, request.period, request.interval ?? null, request.indicatorsKey, request.currency, request.dividends],
    queryFn: async ({ signal }) => {
      const result = await getHistory(request.symbol, request.period, request.interval, requestedIndicators, request.currency ?? undefined, request.dividends, signal);
      const snapshot = buildHistorySnapshotKey(result.prices);
      if (snapshot === prevSnapshotRef.current) {
        staleCountRef.current++;
      } else {
        staleCountRef.current = 0;
      }
      prevSnapshotRef.current = snapshot;
      return result;
    },
    enabled: request.symbol.length > 0,
    refetchInterval: intraday
      ? () => (staleCountRef.current >= 3 ? 300_000 : 30_000)
      : undefined,
  });
}

export function useQuote(symbol: string, currency?: string) {
  return useQuery({
    queryKey: ['quote', symbol, currency],
    queryFn: ({ signal }) => getQuote(symbol, currency, signal),
    enabled: symbol.length > 0,
  });
}

export function useCompare(symbols: string[], currency?: string) {
  return useQuery({
    queryKey: ['compare', ...symbols, currency],
    queryFn: ({ signal }) => compareStocks(symbols, currency, signal),
    enabled: symbols.length > 0,
  });
}

export function useTickerSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: ({ signal }) => searchTickers(query, signal),
    enabled: query.length >= 1,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
