import { expect, test } from '@playwright/test';

const gain = {
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
    name: `${symbol} Inc.`,
    currency: 'USD',
    date: '2026-07-10',
    lastPrice: 101,
    gain,
    peRatio: 20,
    pbRatio: 4,
    eps: 5,
    roe: 0.2,
    marketCap: 1_000_000_000,
    beta: 1,
    dividendYield: 0.01,
    dividendGrowth: 0.05,
    fiftyTwoWeekHigh: 120,
    fiftyTwoWeekLow: 80,
    sector: 'Technology',
    industry: 'Software',
    earningsDate: null,
    recommendation: 'buy',
    analystCount: 20,
    provenance: provenance('2026-07-10', '2026-07-10'),
  };
}

test('keeps request fan-out scoped to the active analysis view', async ({ page }) => {
  const calls: string[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    calls.push(`${url.pathname}${url.search}`);
    if (url.pathname.startsWith('/api/v1/history/')) {
      const symbol = decodeURIComponent(url.pathname.split('/').at(-1) ?? 'AAPL');
      await route.fulfill({ json: {
        symbol,
        name: `${symbol} Inc.`,
        period: '1y',
        interval: '1d',
        adjustment: 'split-adjusted',
        prices: [
          { date: '2026-07-09', open: 100, high: 102, low: 99, close: 101, volume: 1_000, dividend: 0 },
          { date: '2026-07-10', open: 101, high: 103, low: 100, close: 102, volume: 1_100, dividend: 0 },
        ],
        provenance: provenance('2026-07-09', '2026-07-10'),
      } });
      return;
    }
    if (url.pathname === '/api/v1/compare') {
      const symbols = (url.searchParams.get('symbols') ?? '').split(',');
      await route.fulfill({ json: symbols.map((symbol) => ({ symbol, data: quote(symbol), error: null })) });
      return;
    }
    if (url.pathname.startsWith('/api/v1/quote/')) {
      const symbol = decodeURIComponent(url.pathname.split('/').at(-1) ?? 'AAPL');
      await route.fulfill({ json: quote(symbol) });
      return;
    }
    if (url.pathname.startsWith('/api/v1/search/')) {
      await route.fulfill({ json: [] });
      return;
    }
    await route.fulfill({ status: 404, json: { error: 'unexpected' } });
  });

  await page.goto('/?cmp=AAPL');
  await expect(page.getByRole('region', { name: 'Scrollable stock comparison table' })).toBeVisible();
  const compareProvenance = page.getByRole('region', { name: 'Comparison market data provenance' });
  await expect(compareProvenance).toContainText('1/1 quotes · 1/1 histories');
  await expect(compareProvenance).toContainText('AAPL quote: 2026-07-10');
  await expect(compareProvenance).toContainText('AAPL history: 2026-07-09–2026-07-10');
  await expect(compareProvenance).toContainText('Source: Yahoo Finance');
  await expect.poll(() => calls.filter((call) => call.startsWith('/api/v1/history/')).length).toBe(1);
  expect(calls).toContain('/api/v1/history/AAPL?period=1y');
  expect(calls).toContain('/api/v1/compare?symbols=AAPL');
  expect(calls.some((call) => call.includes('indicators='))).toBe(false);

  await page.getByRole('button', { name: 'Exit comparison mode' }).click();
  await expect(page.getByRole('img', { name: 'AAPL price chart' })).toBeVisible();
  const singleProvenance = page.getByRole('region', { name: 'AAPL market data provenance' });
  await expect(singleProvenance).toContainText('Quote: 2026-07-10');
  await expect(singleProvenance).toContainText('History: 2026-07-09–2026-07-10');
  await expect(singleProvenance).toContainText('Market status: Fresh');
  await expect(singleProvenance).toContainText('Adjustment: Split Adjusted');
  await expect.poll(() => calls.filter((call) => call.startsWith('/api/v1/quote/')).length).toBe(1);
  await expect.poll(() => calls.filter((call) => call.startsWith('/api/v1/history/') && call.includes('indicators=')).length).toBe(1);

  const beforeDetails = calls.filter((call) => !call.startsWith('/api/v1/search/')).length;
  await page.getByRole('button', { name: 'Details' }).click();
  await expect(page.getByText('Fundamentals')).toBeVisible();
  expect(calls.filter((call) => !call.startsWith('/api/v1/search/'))).toHaveLength(beforeDetails);

  await page.getByRole('combobox', { name: 'Search ticker' }).fill('MSFT');
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  await expect(page.getByRole('img', { name: 'MSFT price chart' })).toBeVisible();
  await expect.poll(() => calls.filter((call) => call.startsWith('/api/v1/history/MSFT')).length).toBe(1);
  await expect.poll(() => calls.filter((call) => call.startsWith('/api/v1/quote/MSFT')).length).toBe(1);

  await page.getByRole('button', { name: 'Enter comparison mode' }).click();
  await expect(page.getByRole('region', { name: 'Scrollable stock comparison table' })).toBeVisible();
  await expect.poll(() => calls.filter((call) => call.startsWith('/api/v1/history/MSFT')).length).toBe(2);
  await expect.poll(() => calls.filter((call) => call === '/api/v1/compare?symbols=MSFT').length).toBe(1);

  const beforeReturn = calls.filter((call) => !call.startsWith('/api/v1/search/')).length;
  await page.getByRole('button', { name: 'Exit comparison mode' }).click();
  await expect(page.getByRole('img', { name: 'MSFT price chart' })).toBeVisible();
  expect(calls.filter((call) => !call.startsWith('/api/v1/search/'))).toHaveLength(beforeReturn);
});
