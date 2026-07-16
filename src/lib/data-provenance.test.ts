import { describe, expect, it } from 'vitest';
import type { DataProvenance, Quote, StockHistory } from '../api/types';
import {
  historyProvenance,
  quoteProvenance,
  summarizeDataProvenance,
} from './data-provenance';

const provenance: DataProvenance = {
  source: 'YAHOO_FINANCE',
  retrievedAt: '2026-07-12T10:00:00Z',
  unitScale: 1,
  adjustment: 'SPLIT_ADJUSTED',
  status: 'FRESH',
};

const gain = {
  daily: null,
  weekly: null,
  monthly: null,
  quarterly: null,
  halfYearly: null,
  ytd: null,
  yearly: null,
  fiveYear: null,
};

describe('data provenance adapters', () => {
  it('uses the generated nested quote provenance without inferring metadata', () => {
    const quote: Quote = {
      symbol: 'AAPL',
      name: 'Apple',
      currency: 'USD',
      date: '2026-07-10',
      lastPrice: 200,
      gain,
      provenance: {
        ...provenance,
        marketTimestamp: '2026-07-10T20:00:00Z',
        marketDate: '2026-07-10',
        currency: 'USD',
        coverageFrom: '2021-07-12',
        coverageTo: '2026-07-10',
        status: 'PARTIAL',
      },
    };

    expect(quoteProvenance(quote)).toEqual({
      ...quote.provenance,
      label: 'Quote inputs',
      marketFrom: '2021-07-12',
      marketTo: '2026-07-10',
    });
  });

  it('falls back to represented price dates when optional history coverage is absent', () => {
    const history: StockHistory = {
      symbol: 'AAPL',
      name: 'Apple',
      period: '1y',
      interval: '1d',
      prices: [
        { date: '2026-07-10', open: 1, close: 1, low: 1, high: 1, volume: 1, dividend: 0 },
        { date: '2025-07-11', open: 1, close: 1, low: 1, high: 1, volume: 1, dividend: 0 },
      ],
      adjustment: 'split-adjusted',
      requestedFrom: '2025-07-01',
      requestedTo: '2026-07-12',
      provenance,
    };

    expect(historyProvenance(history)).toMatchObject({
      marketFrom: '2025-07-11',
      marketTo: '2026-07-10',
    });
  });

  it('summarizes strict and optional metadata coverage exactly', () => {
    const summary = summarizeDataProvenance([
      {
        ...provenance,
        label: 'AAPL quote inputs',
        marketFrom: '2021-07-12',
        marketTo: '2026-07-10',
        marketTimestamp: '2026-07-10T20:00:00Z',
        currency: 'usd',
      },
      {
        ...provenance,
        label: 'AAPL history',
        marketFrom: '2025-07-11',
        marketTo: '2026-07-10',
      },
    ]);

    expect(summary).toMatchObject({
      itemCount: 2,
      sources: ['YAHOO_FINANCE'],
      retrievedAt: ['2026-07-12T10:00:00Z'],
      marketTimestamps: ['2026-07-10T20:00:00Z'],
      marketTimestampReportedCount: 1,
      currencies: ['USD'],
      currencyReportedCount: 1,
      adjustments: ['SPLIT_ADJUSTED'],
      unitScales: [1],
      statuses: ['FRESH'],
    });
  });

  it('groups identical market scopes without losing dataset labels', () => {
    const summary = summarizeDataProvenance([
      { ...provenance, label: 'AAPL quote inputs', marketFrom: '2026-07-10', marketTo: '2026-07-10' },
      { ...provenance, label: 'MSFT quote inputs', marketFrom: '2026-07-10', marketTo: '2026-07-10' },
    ]);

    expect(summary.marketScopes).toEqual([{
      from: '2026-07-10',
      to: '2026-07-10',
      labels: ['AAPL quote inputs', 'MSFT quote inputs'],
    }]);
  });
});
