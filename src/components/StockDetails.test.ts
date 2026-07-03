import { describe, it, expect } from 'vitest';
import { formatMarketCap, formatNumber, formatRatioPercent } from '../lib/format';

describe('formatMarketCap', () => {
  it('formats trillions', () => {
    expect(formatMarketCap(3.8e12)).toBe('3.8T');
    expect(formatMarketCap(1e12)).toBe('1.0T');
  });

  it('formats billions', () => {
    expect(formatMarketCap(250e9)).toBe('250.0B');
    expect(formatMarketCap(1.5e9)).toBe('1.5B');
  });

  it('formats millions', () => {
    expect(formatMarketCap(42e6)).toBe('42.0M');
    expect(formatMarketCap(1e6)).toBe('1.0M');
  });

  it('formats small numbers', () => {
    expect(formatMarketCap(999999)).toBe('999999');
    expect(formatMarketCap(0)).toBe('0');
  });
});

describe('formatRatioPercent', () => {
  it('converts decimal to percentage', () => {
    expect(formatRatioPercent(0.15)).toBe('15.00%');
    expect(formatRatioPercent(0.004)).toBe('0.40%');
    expect(formatRatioPercent(1.52)).toBe('152.00%');
  });

  it('handles zero', () => {
    expect(formatRatioPercent(0)).toBe('0.00%');
  });

  it('handles negative', () => {
    expect(formatRatioPercent(-0.05)).toBe('-5.00%');
  });
});

describe('formatNumber', () => {
  it('formats number with default 2 decimals', () => {
    expect(formatNumber(123.456)).toBe('123.46');
  });

  it('formats with custom decimals', () => {
    expect(formatNumber(55.123, 1)).toBe('55.1');
  });

  it('returns dash for null', () => {
    expect(formatNumber(null)).toBe('—');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0.00');
  });
});

describe('dividend extraction logic', () => {
  interface Price { date: string; dividend: number }

  function extractDividends(prices: Price[]) {
    return prices
      .filter((p) => p.dividend > 0)
      .map((p) => ({ date: p.date, amount: p.dividend }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  it('filters out zero dividends', () => {
    const prices = [
      { date: '2025-01-01', dividend: 0 },
      { date: '2025-04-01', dividend: 0.25 },
      { date: '2025-07-01', dividend: 0 },
    ];
    expect(extractDividends(prices)).toEqual([
      { date: '2025-04-01', amount: 0.25 },
    ]);
  });

  it('sorts by date descending', () => {
    const prices = [
      { date: '2025-01-01', dividend: 0.20 },
      { date: '2025-07-01', dividend: 0.25 },
      { date: '2025-04-01', dividend: 0.22 },
    ];
    const result = extractDividends(prices);
    expect(result[0].date).toBe('2025-07-01');
    expect(result[1].date).toBe('2025-04-01');
    expect(result[2].date).toBe('2025-01-01');
  });

  it('returns empty for no dividends', () => {
    expect(extractDividends([])).toEqual([]);
    expect(extractDividends([{ date: '2025-01-01', dividend: 0 }])).toEqual([]);
  });
});
