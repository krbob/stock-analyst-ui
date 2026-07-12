import { describe, expect, it } from 'vitest';
import type { Quote, StockHistory } from '../api/types';
import {
  historyProvenance,
  quoteProvenance,
  summarizeDataProvenance,
} from './data-provenance';

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
  it('uses API-provided quote metadata without inferring a provider or freshness', () => {
    const item = quoteProvenance({
      symbol: 'AAPL',
      name: 'Apple',
      currency: 'USD',
      date: '2026-07-10',
      lastPrice: 200,
      gain,
      peRatio: null,
      pbRatio: null,
      eps: null,
      roe: null,
      marketCap: null,
      beta: null,
      dividendYield: null,
      dividendGrowth: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      sector: null,
      industry: null,
      earningsDate: null,
      recommendation: null,
      analystCount: null,
    });

    expect(item).toMatchObject({ marketFrom: '2026-07-10', marketTo: '2026-07-10' });
    expect(item.source).toBeUndefined();
    expect(item.retrievedAt).toBeUndefined();
    expect(item.status).toBeUndefined();
  });

  it('derives the represented history range from unsorted prices, not the requested window', () => {
    const item = historyProvenance({
      symbol: 'AAPL',
      name: 'Apple',
      period: '1y',
      interval: '1d',
      prices: [
        { date: '2026-07-10', open: 1, close: 1, low: 1, high: 1, volume: 1, dividend: 0 },
        { date: '2025-07-11', open: 1, close: 1, low: 1, high: 1, volume: 1, dividend: 0 },
      ],
      requestedFrom: '2025-07-01',
      requestedTo: '2026-07-12',
    } as StockHistory);

    expect(item).toMatchObject({ marketFrom: '2025-07-11', marketTo: '2026-07-10' });
  });

  it('keeps future optional metadata and reports partial coverage exactly', () => {
    const quote = {
      date: '2026-07-10',
      source: 'Provider A',
      retrievedAt: '2026-07-12T10:00:00Z',
      status: 'delayed',
    } as Quote;
    const summary = summarizeDataProvenance([
      quoteProvenance(quote, 'AAPL quote'),
      { label: 'AAPL history', marketFrom: '2025-07-11', marketTo: '2026-07-10' },
    ]);

    expect(summary).toMatchObject({
      itemCount: 2,
      sources: ['Provider A'],
      sourceReportedCount: 1,
      retrievedAt: ['2026-07-12T10:00:00Z'],
      retrievedAtReportedCount: 1,
      statuses: ['delayed'],
      statusReportedCount: 1,
    });
  });

  it('groups identical market scopes without losing dataset labels', () => {
    const summary = summarizeDataProvenance([
      { label: 'AAPL quote', marketFrom: '2026-07-10', marketTo: '2026-07-10' },
      { label: 'MSFT quote', marketFrom: '2026-07-10', marketTo: '2026-07-10' },
    ]);

    expect(summary.marketScopes).toEqual([{
      from: '2026-07-10',
      to: '2026-07-10',
      labels: ['AAPL quote', 'MSFT quote'],
    }]);
  });
});
