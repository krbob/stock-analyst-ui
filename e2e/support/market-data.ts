import type { Page } from '@playwright/test';

const GAIN = {
  daily: 0.01,
  weekly: 0.02,
  monthly: 0.03,
  quarterly: 0.04,
  halfYearly: 0.05,
  ytd: 0.06,
  yearly: 0.07,
  fiveYear: 0.08,
};

function provenance(coverageFrom: string, coverageTo: string) {
  return {
    source: 'YAHOO_FINANCE',
    retrievedAt: '2026-07-12T10:00:00Z',
    marketTimestamp: '2026-07-10T20:00:00Z',
    marketDate: '2026-07-10',
    currency: 'USD',
    unitScale: 1,
    adjustment: 'SPLIT_ADJUSTED',
    coverageFrom,
    coverageTo,
    status: 'FRESH',
  };
}

function quote(symbol: string) {
  return {
    symbol,
    name: symbol === 'MSFT' ? 'Microsoft Corporation' : 'Apple Inc.',
    currency: 'USD',
    date: '2026-07-10',
    lastPrice: symbol === 'MSFT' ? 510 : 230,
    gain: GAIN,
    peRatio: 25,
    pbRatio: 8,
    eps: 9,
    roe: 0.35,
    marketCap: 3_000_000_000_000,
    beta: 1.1,
    dividendYield: 0.005,
    dividendGrowth: 0.04,
    fiftyTwoWeekHigh: 550,
    fiftyTwoWeekLow: 350,
    sector: 'Technology',
    industry: 'Software',
    earningsDate: '2026-08-01',
    recommendation: 'buy',
    analystCount: 35,
    provenance: provenance('2025-07-11', '2026-07-10'),
  };
}

function history(symbol: string, period: string, interval: string) {
  const offset = symbol === 'MSFT' ? 200 : 0;
  return {
    symbol,
    name: quote(symbol).name,
    period,
    interval,
    adjustment: 'split-adjusted',
    currency: 'USD',
    prices: [
      { date: '2026-07-08', open: 220 + offset, high: 225 + offset, low: 218 + offset, close: 223 + offset, volume: 1_000_000, dividend: 0 },
      { date: '2026-07-09', open: 223 + offset, high: 229 + offset, low: 221 + offset, close: 227 + offset, volume: 1_100_000, dividend: 0 },
      { date: '2026-07-10', open: 227 + offset, high: 233 + offset, low: 226 + offset, close: 230 + offset, volume: 1_200_000, dividend: 0 },
    ],
    provenance: provenance('2026-07-08', '2026-07-10'),
  };
}

export async function mockMarketData(page: Page): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/v1/history/')) {
      const symbol = decodeURIComponent(url.pathname.split('/').at(-1) ?? 'AAPL').toUpperCase();
      await route.fulfill({
        json: history(
          symbol,
          url.searchParams.get('period') ?? '1y',
          url.searchParams.get('interval') ?? '1d',
        ),
      });
      return;
    }
    if (url.pathname === '/api/v1/compare') {
      const symbols = (url.searchParams.get('symbols') ?? 'AAPL').split(',');
      await route.fulfill({
        json: symbols.map((symbol) => ({ symbol, data: quote(symbol.toUpperCase()), error: null })),
      });
      return;
    }
    if (url.pathname.startsWith('/api/v1/quote/')) {
      const symbol = decodeURIComponent(url.pathname.split('/').at(-1) ?? 'AAPL').toUpperCase();
      await route.fulfill({ json: quote(symbol) });
      return;
    }
    if (url.pathname.startsWith('/api/v1/search/')) {
      const query = decodeURIComponent(url.pathname.split('/').at(-1) ?? '').toUpperCase();
      await route.fulfill({
        json: query.includes('MSFT')
          ? [{ symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NMS', quoteType: 'EQUITY' }]
          : [],
      });
      return;
    }
    await route.fulfill({
      status: 404,
      json: {
        error: 'Unexpected mocked API request',
        errorCode: 'ROUTE_NOT_FOUND',
        retryable: false,
        requestId: 'e2e-unexpected-route',
      },
    });
  });
}
