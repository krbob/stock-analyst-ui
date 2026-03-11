import { useRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getHistory, getAnalysis, getPrice, compareStocks, searchTickers } from './client';
import type { Interval, Period } from './types';
import { INTRADAY_INTERVALS } from './types';

export function useStockHistory(symbol: string, period: Period = '1y', interval?: Interval, indicators?: string[], currency?: string, dividends?: boolean) {
  const intraday = interval != null && INTRADAY_INTERVALS.includes(interval);
  const staleCountRef = useRef(0);
  const prevBarCountRef = useRef(0);
  return useQuery({
    queryKey: ['history', symbol, period, interval, indicators, currency, dividends],
    queryFn: async () => {
      const result = await getHistory(symbol, period, interval, indicators, currency, dividends);
      const count = result.prices.length;
      if (count === prevBarCountRef.current) {
        staleCountRef.current++;
      } else {
        staleCountRef.current = 0;
      }
      prevBarCountRef.current = count;
      return result;
    },
    enabled: symbol.length > 0,
    placeholderData: keepPreviousData,
    refetchInterval: intraday
      ? () => (staleCountRef.current >= 3 ? 300_000 : 30_000)
      : undefined,
  });
}

export function useAnalysis(symbol: string, currency?: string) {
  return useQuery({
    queryKey: ['analysis', symbol, currency],
    queryFn: () => getAnalysis(symbol, currency),
    enabled: symbol.length > 0,
  });
}

export function usePrice(symbol: string, currency?: string) {
  return useQuery({
    queryKey: ['price', symbol, currency],
    queryFn: () => getPrice(symbol, currency),
    enabled: symbol.length > 0,
  });
}

export function useCompare(symbols: string[]) {
  return useQuery({
    queryKey: ['compare', ...symbols],
    queryFn: () => compareStocks(symbols),
    enabled: symbols.length > 0,
  });
}

export function useTickerSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => searchTickers(query),
    enabled: query.length >= 1,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
