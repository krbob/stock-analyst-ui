import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getHistory, getAnalysis, getPrice, getDividends, compareStocks, searchTickers } from './client';
import type { Interval, Period } from './types';

export function useStockHistory(symbol: string, period: Period = '1y', interval?: Interval) {
  return useQuery({
    queryKey: ['history', symbol, period, interval],
    queryFn: () => getHistory(symbol, period, interval),
    enabled: symbol.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useAnalysis(symbol: string) {
  return useQuery({
    queryKey: ['analysis', symbol],
    queryFn: () => getAnalysis(symbol),
    enabled: symbol.length > 0,
  });
}

export function usePrice(symbol: string) {
  return useQuery({
    queryKey: ['price', symbol],
    queryFn: () => getPrice(symbol),
    enabled: symbol.length > 0,
  });
}

export function useDividends(symbol: string) {
  return useQuery({
    queryKey: ['dividends', symbol],
    queryFn: () => getDividends(symbol),
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
