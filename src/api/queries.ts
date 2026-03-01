import { useQuery } from '@tanstack/react-query';
import { getHistory, getAnalysis, getPrice, getDividends, compareStocks } from './client';
import type { Period } from './types';

export function useStockHistory(symbol: string, period: Period = '1y') {
  return useQuery({
    queryKey: ['history', symbol, period],
    queryFn: () => getHistory(symbol, period),
    enabled: symbol.length > 0,
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
