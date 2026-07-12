import { describe, expect, it } from 'vitest';
import type { HistoricalPrice } from '../api/types';
import { describeComparisonChart, describePriceChart } from './chart-accessibility';

function price(date: string, close: number, low = close, high = close): HistoricalPrice {
  return { date, open: close, close, low, high, volume: 1, dividend: 0 };
}

describe('chart accessibility descriptions', () => {
  it('summarizes range, latest close and change using the selected interval', () => {
    const description = describePriceChart(
      'aapl',
      [price('2026-07-01', 100, 98, 102), price('2026-07-02', 110, 105, 112)],
      '15m',
      'USD',
    );

    expect(description).toContain('AAPL price chart with 2 15m candles');
    expect(description).toContain('Latest close 110.00 USD, up 10.00 percent');
    expect(description).toContain('Observed low 98.00 and high 112.00 USD');
  });

  it('describes an empty chart without exposing NaN values', () => {
    expect(describePriceChart('msft', [], '1d', undefined)).toBe(
      'MSFT price chart. No price data is available.',
    );
  });

  it('states comparison coverage and normalization baseline', () => {
    const description = describeComparisonChart(['AAPL', 'MSFT'], 1, '5y');
    expect(description).toContain('1 of 2 series loaded');
    expect(description).toContain('fixed zero-percent baseline');
  });
});
