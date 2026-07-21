import type { Page } from '@playwright/test';

const GAIN = {
  daily: 0.012,
  weekly: 0.02,
  monthly: -0.008,
  quarterly: 0.09,
  halfYearly: 0.16,
  ytd: 0.21,
  yearly: 0.445,
  fiveYear: 1.12,
};

const MARKET_DATE = '2026-07-17';

interface MarketPoint {
  date: string;
  timestamp: number;
}

interface MockPrice extends MarketPoint {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  dividend: number;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function businessDays(count: number): MarketPoint[] {
  const dates: MarketPoint[] = [];
  const cursor = new Date(`${MARKET_DATE}T20:00:00Z`);

  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push({
        date: cursor.toISOString().slice(0, 10),
        timestamp: Math.floor(cursor.getTime() / 1_000),
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return dates.reverse();
}

function generatedPrices(symbol: string): MockPrice[] {
  const points = businessDays(260);
  const isMicrosoft = symbol === 'MSFT';
  const start = isMicrosoft ? 345 : 205;
  const target = isMicrosoft ? 510 : 308.63;
  const finalIndex = points.length - 1;
  const finalWave = 7 * Math.sin(finalIndex / 13) + 3.5 * Math.sin(finalIndex / 4.7);
  let previousClose = start;

  return points.map((point, index) => {
    const progress = index / finalIndex;
    const trend = start + (target - start) * progress;
    const wave = 7 * Math.sin(index / 13) + 3.5 * Math.sin(index / 4.7) - finalWave * progress;
    const close = round(trend + wave);
    const open = round(index === 0 ? close - 0.85 : previousClose + 1.2 * Math.sin(index / 3.2));
    const high = round(Math.max(open, close) + 1.1 + Math.abs(Math.sin(index / 2.8)) * 1.7);
    const low = round(Math.min(open, close) - 1.05 - Math.abs(Math.cos(index / 3.6)) * 1.5);
    const volume = Math.round(38_000_000 + 13_000_000 * (1 + Math.sin(index / 6.5)) + (index % 63 === 0 ? 28_000_000 : 0));
    previousClose = close;
    return { ...point, open, high, low, close, volume, dividend: 0 };
  });
}

function movingAverage(prices: MockPrice[], window: number) {
  return prices.slice(window - 1).map((price, index) => {
    const end = index + window;
    const values = prices.slice(index, end);
    return {
      date: price.date,
      timestamp: price.timestamp,
      value: round(values.reduce((sum, item) => sum + item.close, 0) / window),
    };
  });
}

function provenance(coverageFrom: string, coverageTo: string) {
  return {
    source: 'YAHOO_FINANCE',
    retrievedAt: '2026-07-17T20:05:00Z',
    marketTimestamp: '2026-07-17T20:00:00Z',
    marketDate: MARKET_DATE,
    currency: 'USD',
    unitScale: 1,
    adjustment: 'SPLIT_ADJUSTED',
    coverageFrom,
    coverageTo,
    status: 'FRESH',
  };
}

function quote(symbol: string) {
  const isMicrosoft = symbol === 'MSFT';
  return {
    symbol,
    name: isMicrosoft ? 'Microsoft Corporation' : 'Apple Inc.',
    currency: 'USD',
    date: MARKET_DATE,
    lastPrice: isMicrosoft ? 510 : 308.63,
    gain: GAIN,
    peRatio: isMicrosoft ? 34.8 : 32.12,
    pbRatio: isMicrosoft ? 12.4 : 42.51,
    eps: isMicrosoft ? 14.65 : 8.27,
    roe: isMicrosoft ? 0.34 : 1.41,
    marketCap: isMicrosoft ? 3_800_000_000_000 : 4_500_000_000_000,
    beta: 1.1,
    dividendYield: isMicrosoft ? 0.006 : 0.003,
    dividendGrowth: 0.04,
    fiftyTwoWeekHigh: isMicrosoft ? 540 : 317.4,
    fiftyTwoWeekLow: isMicrosoft ? 344 : 201.5,
    sector: 'Technology',
    industry: isMicrosoft ? 'Software' : 'Consumer Electronics',
    earningsDate: null,
    recommendation: 'buy',
    analystCount: isMicrosoft ? 48 : 42,
    provenance: provenance(MARKET_DATE, MARKET_DATE),
  };
}

function history(symbol: string, period: string, interval: string) {
  const prices = generatedPrices(symbol);
  return {
    symbol,
    name: quote(symbol).name,
    period,
    interval,
    adjustment: 'split-adjusted',
    currency: 'USD',
    prices,
    indicators: {
      sma50: movingAverage(prices, 50),
      sma200: movingAverage(prices, 200),
    },
    provenance: provenance(prices[0].date, prices.at(-1)?.date ?? MARKET_DATE),
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
