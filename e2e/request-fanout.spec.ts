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
  };
}

test('keeps request fan-out scoped to the active analysis view', async ({ page }) => {
  const calls: string[] = [];
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    calls.push(`${url.pathname}${url.search}`);
    if (url.pathname.startsWith('/api/history/')) {
      const symbol = decodeURIComponent(url.pathname.split('/').at(-1) ?? 'AAPL');
      await route.fulfill({ json: {
        symbol,
        name: `${symbol} Inc.`,
        period: '1y',
        interval: '1d',
        prices: [
          { date: '2026-07-09', open: 100, high: 102, low: 99, close: 101, volume: 1_000, dividend: 0 },
          { date: '2026-07-10', open: 101, high: 103, low: 100, close: 102, volume: 1_100, dividend: 0 },
        ],
      } });
      return;
    }
    if (url.pathname === '/api/compare') {
      const symbols = (url.searchParams.get('symbols') ?? '').split(',');
      await route.fulfill({ json: symbols.map((symbol) => ({ symbol, data: quote(symbol), error: null })) });
      return;
    }
    if (url.pathname.startsWith('/api/quote/')) {
      const symbol = decodeURIComponent(url.pathname.split('/').at(-1) ?? 'AAPL');
      await route.fulfill({ json: quote(symbol) });
      return;
    }
    if (url.pathname.startsWith('/api/search/')) {
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
  await expect(compareProvenance).toContainText('Source: not reported by API');
  await expect.poll(() => calls.filter((call) => call.startsWith('/api/history/')).length).toBe(1);
  expect(calls).toContain('/api/history/AAPL?period=1y');
  expect(calls).toContain('/api/compare?symbols=AAPL');
  expect(calls.some((call) => call.includes('indicators='))).toBe(false);

  await page.getByRole('button', { name: 'Exit comparison mode' }).click();
  await expect(page.getByRole('img', { name: 'AAPL price chart' })).toBeVisible();
  const singleProvenance = page.getByRole('region', { name: 'AAPL market data provenance' });
  await expect(singleProvenance).toContainText('Quote: 2026-07-10');
  await expect(singleProvenance).toContainText('History: 2026-07-09–2026-07-10');
  await expect(singleProvenance).toContainText('Freshness status: not reported by API');
  await expect.poll(() => calls.filter((call) => call.startsWith('/api/quote/')).length).toBe(1);
  await expect.poll(() => calls.filter((call) => call.startsWith('/api/history/') && call.includes('indicators=')).length).toBe(1);

  const beforeDetails = calls.filter((call) => !call.startsWith('/api/search/')).length;
  await page.getByRole('button', { name: 'Details' }).click();
  await expect(page.getByText('Fundamentals')).toBeVisible();
  expect(calls.filter((call) => !call.startsWith('/api/search/'))).toHaveLength(beforeDetails);

  await page.getByRole('combobox', { name: 'Search ticker' }).fill('MSFT');
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  await expect(page.getByRole('img', { name: 'MSFT price chart' })).toBeVisible();
  await expect.poll(() => calls.filter((call) => call.startsWith('/api/history/MSFT')).length).toBe(1);
  await expect.poll(() => calls.filter((call) => call.startsWith('/api/quote/MSFT')).length).toBe(1);

  await page.getByRole('button', { name: 'Enter comparison mode' }).click();
  await expect(page.getByRole('region', { name: 'Scrollable stock comparison table' })).toBeVisible();
  await expect.poll(() => calls.filter((call) => call.startsWith('/api/history/MSFT')).length).toBe(2);
  await expect.poll(() => calls.filter((call) => call === '/api/compare?symbols=MSFT').length).toBe(1);

  const beforeReturn = calls.filter((call) => !call.startsWith('/api/search/')).length;
  await page.getByRole('button', { name: 'Exit comparison mode' }).click();
  await expect(page.getByRole('img', { name: 'MSFT price chart' })).toBeVisible();
  expect(calls.filter((call) => !call.startsWith('/api/search/'))).toHaveLength(beforeReturn);
});
