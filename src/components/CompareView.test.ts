import { describe, it, expect } from 'vitest';
import type { Time } from 'lightweight-charts';
import { normalizeFromTime, findBaseIndexByTime, findBestIdx } from './compare-utils';
import type { HistoricalPrice } from '../api/types';

function mkPrice(date: string, close: number): HistoricalPrice {
  return { date, close, open: close, high: close, low: close, volume: 0 } as HistoricalPrice;
}

// ---------------------------------------------------------------------------
// normalizeFromTime
// ---------------------------------------------------------------------------

describe('normalizeFromTime', () => {
  it('returns empty for empty array', () => {
    expect(normalizeFromTime([], null)).toEqual([]);
  });

  it('returns empty when base close is 0', () => {
    expect(normalizeFromTime([mkPrice('2025-01-01', 0)], null)).toEqual([]);
  });

  it('first point is always 0% when baseTime is null', () => {
    const result = normalizeFromTime([
      mkPrice('2025-01-01', 100),
      mkPrice('2025-01-02', 110),
    ], null);
    expect(result[0].value).toBe(0);
  });

  it('calculates percentage change correctly', () => {
    const result = normalizeFromTime([
      mkPrice('2025-01-01', 100),
      mkPrice('2025-01-02', 110),
      mkPrice('2025-01-03', 90),
    ], null);
    expect(result[1].value).toBeCloseTo(10);
    expect(result[2].value).toBeCloseTo(-10);
  });

  it('normalizes from a specific base time', () => {
    const result = normalizeFromTime([
      mkPrice('2025-01-01', 100),
      mkPrice('2025-01-02', 110),
      mkPrice('2025-01-03', 121),
    ], '2025-01-02' as Time);
    expect(result[0].value).toBeCloseTo(-9.09, 1); // (100/110 - 1) * 100
    expect(result[1].value).toBe(0);                // (110/110 - 1) * 100
    expect(result[2].value).toBeCloseTo(10);         // (121/110 - 1) * 100
  });

  it('handles baseTime before all data — normalizes from first point', () => {
    const result = normalizeFromTime([
      mkPrice('2025-02-01', 100),
      mkPrice('2025-02-02', 120),
    ], '2025-01-01' as Time);
    expect(result[0].value).toBe(0);
    expect(result[1].value).toBeCloseTo(20);
  });

  it('handles baseTime after all data — normalizes from last point', () => {
    const result = normalizeFromTime([
      mkPrice('2025-01-01', 100),
      mkPrice('2025-01-02', 200),
    ], '2025-12-31' as Time);
    expect(result[0].value).toBeCloseTo(-50); // (100/200 - 1) * 100
    expect(result[1].value).toBe(0);
  });

  it('two instruments with different start dates normalize correctly from same baseTime', () => {
    const longHistory = [
      mkPrice('2020-01-01', 50),
      mkPrice('2021-01-01', 80),
      mkPrice('2022-01-01', 100),
      mkPrice('2023-01-01', 120),
    ];
    const shortHistory = [
      mkPrice('2022-01-01', 200),
      mkPrice('2023-01-01', 250),
    ];

    const baseTime = '2022-01-01' as Time;
    const resultLong = normalizeFromTime(longHistory, baseTime);
    const resultShort = normalizeFromTime(shortHistory, baseTime);

    // Both should normalize from their 2022-01-01 data point
    expect(resultLong[2].value).toBe(0);   // 2022-01-01: base for long
    expect(resultShort[0].value).toBe(0);  // 2022-01-01: base for short

    // Both should show correct % for 2023-01-01
    expect(resultLong[3].value).toBeCloseTo(20);  // (120/100 - 1) * 100
    expect(resultShort[1].value).toBeCloseTo(25);  // (250/200 - 1) * 100
  });
});

// ---------------------------------------------------------------------------
// findBaseIndexByTime
// ---------------------------------------------------------------------------

describe('findBaseIndexByTime', () => {
  const prices = [
    mkPrice('2025-01-01', 100),
    mkPrice('2025-01-03', 110),
    mkPrice('2025-01-05', 120),
    mkPrice('2025-01-07', 130),
  ];

  it('finds exact date match', () => {
    expect(findBaseIndexByTime(prices, '2025-01-03' as Time)).toBe(1);
  });

  it('finds first date after target when no exact match', () => {
    expect(findBaseIndexByTime(prices, '2025-01-02' as Time)).toBe(1);
  });

  it('returns 0 when target is before all data', () => {
    expect(findBaseIndexByTime(prices, '2024-01-01' as Time)).toBe(0);
  });

  it('returns last index when target is after all data', () => {
    expect(findBaseIndexByTime(prices, '2026-01-01' as Time)).toBe(prices.length - 1);
  });

  it('works with single-element array', () => {
    const single = [mkPrice('2025-06-01', 50)];
    expect(findBaseIndexByTime(single, '2025-01-01' as Time)).toBe(0);
    expect(findBaseIndexByTime(single, '2025-06-01' as Time)).toBe(0);
    expect(findBaseIndexByTime(single, '2025-12-01' as Time)).toBe(0);
  });

  it('finds first element', () => {
    expect(findBaseIndexByTime(prices, '2025-01-01' as Time)).toBe(0);
  });

  it('finds last element', () => {
    expect(findBaseIndexByTime(prices, '2025-01-07' as Time)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// findBestIdx
// ---------------------------------------------------------------------------

describe('findBestIdx', () => {
  it('finds max index', () => {
    expect(findBestIdx([10, 30, 20], 'max')).toBe(1);
  });

  it('finds min index', () => {
    expect(findBestIdx([10, 30, 20], 'min')).toBe(0);
  });

  it('returns -1 for all nulls', () => {
    expect(findBestIdx([null, null], 'max')).toBe(-1);
  });

  it('skips null values', () => {
    expect(findBestIdx([null, 5, null, 10], 'max')).toBe(3);
  });

  it('skips string values', () => {
    expect(findBestIdx(['Tech', 'Finance'], 'max')).toBe(-1);
  });

  it('handles negative values for max', () => {
    expect(findBestIdx([-5, -3, -10], 'max')).toBe(1);
  });

  it('handles negative values for min', () => {
    expect(findBestIdx([-5, -3, -10], 'min')).toBe(2);
  });

  it('handles single value', () => {
    expect(findBestIdx([42], 'max')).toBe(0);
  });

  it('returns -1 when best value is tied', () => {
    expect(findBestIdx([10, 30, 30], 'max')).toBe(-1);
    expect(findBestIdx([5, 5, 10], 'min')).toBe(-1);
  });

  it('highlights best when no tie', () => {
    expect(findBestIdx([0, 0.01, 0], 'max')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Formatting functions (kept inline as they are not exported from compare-utils)
// ---------------------------------------------------------------------------

const fmtNum = (d: number) => d.toFixed(2);
const fmtPct = (d: number) => (d >= 0 ? '+' : '') + (d * 100).toFixed(2) + '%';
const fmtRate = (d: number) => (d * 100).toFixed(2) + '%';
const fmtBig = (d: number) => {
  if (d >= 1e12) return (d / 1e12).toFixed(1) + 'T';
  if (d >= 1e9) return (d / 1e9).toFixed(1) + 'B';
  if (d >= 1e6) return (d / 1e6).toFixed(1) + 'M';
  return d.toFixed(0);
};

describe('formatting functions', () => {
  describe('fmtNum', () => {
    it('formats to 2 decimal places', () => {
      expect(fmtNum(123.456)).toBe('123.46');
      expect(fmtNum(0)).toBe('0.00');
    });
  });

  describe('fmtPct', () => {
    it('adds + for positive', () => {
      expect(fmtPct(0.2)).toBe('+20.00%');
    });

    it('shows - for negative', () => {
      expect(fmtPct(-0.05)).toBe('-5.00%');
    });

    it('handles zero', () => {
      expect(fmtPct(0)).toBe('+0.00%');
    });
  });

  describe('fmtRate', () => {
    it('formats rate as percentage without +', () => {
      expect(fmtRate(0.15)).toBe('15.00%');
      expect(fmtRate(0.004)).toBe('0.40%');
    });
  });

  describe('fmtBig', () => {
    it('formats trillions', () => {
      expect(fmtBig(3.8e12)).toBe('3.8T');
    });

    it('formats billions', () => {
      expect(fmtBig(1.5e9)).toBe('1.5B');
    });

    it('formats millions', () => {
      expect(fmtBig(42e6)).toBe('42.0M');
    });

    it('formats small numbers', () => {
      expect(fmtBig(1234)).toBe('1234');
    });
  });
});
