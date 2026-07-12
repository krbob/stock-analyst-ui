import type { Time } from 'lightweight-charts';
import type { HistoricalPrice } from '../api/types';

export function chartTime(p: HistoricalPrice): Time {
  return p.timestamp != null ? p.timestamp as Time : p.date as Time;
}

/**
 * Binary search: find the first price entry with time >= baseTime.
 * Falls back to the last index if all entries are before baseTime.
 */
export function findBaseIndexByTime(prices: HistoricalPrice[], baseTime: Time): number {
  let lo = 0;
  let hi = prices.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (chartTime(prices[mid]) < baseTime) lo = mid + 1;
    else hi = mid;
  }
  return Math.min(lo, prices.length - 1);
}

/**
 * Normalize prices as percentage change from a base point.
 * When baseTime is null, normalizes from the first data point (index 0).
 * Otherwise finds the closest data point at or after baseTime.
 */
export function normalizeFromTime(
  prices: HistoricalPrice[],
  baseTime: Time | null,
): { time: Time; value: number }[] {
  if (prices.length === 0) return [];
  const idx = baseTime === null ? 0 : findBaseIndexByTime(prices, baseTime);
  const base = prices[idx].close;
  if (base === 0) return [];
  return prices.map((p) => ({
    time: chartTime(p),
    value: (p.close / base - 1) * 100,
  }));
}

export function findBestIdx(values: (number | string | null | undefined)[], dir: 'max' | 'min'): number {
  let best = -1;
  let bestVal = dir === 'max' ? -Infinity : Infinity;
  let tied = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (typeof v !== 'number') continue;
    if (dir === 'max' ? v > bestVal : v < bestVal) {
      bestVal = v;
      best = i;
      tied = false;
    } else if (v === bestVal) {
      tied = true;
    }
  }
  return tied ? -1 : best;
}
