import { expect, test, type Page } from '@playwright/test';

const SYMBOLS = ['AAPL', 'MSFT', 'GOOG', 'AMZN', 'NVDA', 'META'];

const GAINS = {
  daily: 0.0125,
  weekly: 0.025,
  monthly: 0.0475,
  quarterly: 0.085,
  halfYearly: 0.125,
  ytd: 0.1525,
  yearly: 0.2275,
  fiveYear: 1.455,
};

function provenance(currency: string, coverageFrom: string, coverageTo: string) {
  return {
    source: 'YAHOO_FINANCE',
    retrievedAt: '2026-07-12T10:00:00Z',
    marketTimestamp: '2026-07-10T20:00:00Z',
    marketDate: '2026-07-10',
    currency,
    unitScale: 1,
    adjustment: 'SPLIT_ADJUSTED',
    coverageFrom,
    coverageTo,
    status: 'FRESH',
  };
}

function quote(symbol: string, index: number) {
  return {
    symbol,
    name: `${symbol} Corporation with a deliberately long company name`,
    currency: 'PLN',
    date: '2026-07-10',
    lastPrice: 100 + index * 17.25,
    gain: { ...GAINS, daily: GAINS.daily + index / 100 },
    peRatio: 18 + index,
    pbRatio: 4 + index / 10,
    eps: 5 + index,
    roe: 0.2 + index / 100,
    marketCap: 1_000_000_000_000 + index * 100_000_000_000,
    beta: 0.9 + index / 10,
    dividendYield: 0.01 + index / 1000,
    dividendGrowth: 0.05 + index / 100,
    fiftyTwoWeekHigh: 160 + index * 10,
    fiftyTwoWeekLow: 80 + index * 5,
    sector: 'Technology',
    industry: 'Software and services',
    earningsDate: '2026-08-01',
    recommendation: 'buy',
    analystCount: 30 + index,
    provenance: provenance('PLN', '2026-07-10', '2026-07-10'),
  };
}

async function mockApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/compare') {
      await route.fulfill({
        json: SYMBOLS.map((symbol, index) => ({ symbol, data: quote(symbol, index), error: null })),
      });
      return;
    }

    if (url.pathname.startsWith('/api/v1/history/')) {
      const symbol = decodeURIComponent(url.pathname.split('/').at(-1) ?? 'AAPL').toUpperCase();
      const index = Math.max(0, SYMBOLS.indexOf(symbol));
      await route.fulfill({
        json: {
          symbol,
          name: quote(symbol, index).name,
          period: '1y',
          interval: '1d',
          adjustment: 'split-adjusted',
          currency: url.searchParams.get('currency') ?? 'USD',
          prices: [
            { date: '2026-07-08', open: 100, high: 103, low: 99, close: 101 + index, volume: 1_000_000, dividend: 0 },
            { date: '2026-07-09', open: 101, high: 105, low: 100, close: 103 + index, volume: 1_100_000, dividend: 0 },
            { date: '2026-07-10', open: 103, high: 108, low: 102, close: 106 + index, volume: 1_200_000, dividend: 0 },
          ],
          provenance: provenance(
            url.searchParams.get('currency') ?? 'USD',
            '2026-07-08',
            '2026-07-10',
          ),
        },
      });
      return;
    }

    if (url.pathname.startsWith('/api/v1/search/')) {
      await route.fulfill({ json: [] });
      return;
    }

    await route.fulfill({ status: 404, json: { error: 'Unexpected mocked API request' } });
  });
}

for (const width of [320, 375]) {
  test(`keeps comparison controls and wide data usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page);
    await page.goto(`/?cmp=${SYMBOLS.join(',')}&cur=PLN`);

    const heading = page.getByRole('heading', { name: 'Stock Analyst' });
    const ticker = page.getByRole('combobox', { name: 'Search ticker' });
    const go = page.getByRole('button', { name: 'Go', exact: true });
    const currency = page.getByRole('button', { name: 'Select currency' });
    const exitCompare = page.getByRole('button', { name: 'Exit comparison mode' });
    const theme = page.getByRole('button', { name: /theme active/i });
    const chart = page.getByRole('img', { name: `Percentage comparison chart for ${SYMBOLS.join(', ')}` });
    const tableRegion = page.getByRole('region', { name: 'Scrollable stock comparison table' });
    const provenance = page.getByRole('region', { name: 'Comparison market data provenance' });

    await expect(heading).toBeVisible();
    await expect(ticker).toBeVisible();
    await expect(go).toBeVisible();
    await expect(currency).toContainText('PLN');
    await expect(exitCompare).toBeVisible();
    await expect(theme).toBeVisible();
    await expect(chart).toBeVisible();
    await expect(tableRegion).toBeVisible();
    await expect(provenance).toContainText('6/6 quotes · 6/6 histories');
    await expect(provenance).toContainText('Source: Yahoo Finance');
    await expect(provenance).toContainText('Market status: Fresh');
    await expect(provenance).toContainText('Unit scale: ×1');

    const layout = await page.evaluate(() => {
      const headerElement = document.querySelector('header');
      const headingElement = document.querySelector('h1');
      const tickerElement = document.querySelector<HTMLInputElement>('[aria-label="Search ticker"]');
      if (!headerElement || !headingElement || !tickerElement) throw new Error('Header controls missing');
      const headingBox = headingElement.getBoundingClientRect();
      const tickerBox = tickerElement.getBoundingClientRect();
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        headerHeight: headerElement.getBoundingClientRect().height,
        tickerStartsBelowTitle: tickerBox.top >= headingBox.bottom,
      };
    });
    expect(layout.documentWidth).toBe(layout.viewportWidth);
    expect(layout.headerHeight).toBeLessThanOrEqual(100);
    expect(layout.tickerStartsBelowTitle).toBe(true);

    for (const control of [heading, ticker, go, currency, exitCompare, theme]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }

    const baseBox = await page.getByText('Base: first point in selected period').boundingBox();
    const chartBox = await chart.boundingBox();
    expect(baseBox).not.toBeNull();
    expect(chartBox).not.toBeNull();
    expect(baseBox!.y + baseBox!.height).toBeLessThanOrEqual(chartBox!.y + 1);
    expect(chartBox!.height).toBe(260);

    const tableOverflow = await tableRegion.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(tableOverflow.scrollWidth).toBeGreaterThan(tableOverflow.clientWidth);

    const metricHeader = page.getByRole('columnheader', { name: 'Metric' });
    const metricX = (await metricHeader.boundingBox())!.x;
    await tableRegion.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    await expect.poll(async () => (await metricHeader.boundingBox())!.x).toBeCloseTo(metricX, 0);

    await ticker.fill('NORESULT');
    const noResults = page.getByText('No tickers found');
    await expect(noResults).toBeVisible();
    const tickerPopup = noResults.locator('..').locator('..');
    const tickerPopupBox = await tickerPopup.boundingBox();
    expect(tickerPopupBox).not.toBeNull();
    expect(tickerPopupBox!.x).toBeGreaterThanOrEqual(0);
    expect(tickerPopupBox!.x + tickerPopupBox!.width).toBeLessThanOrEqual(width);
    await ticker.press('Escape');

    await currency.click();
    const currencyPopup = page.getByRole('listbox', { name: 'Currencies' }).locator('..');
    await expect(currencyPopup).toBeVisible();
    const currencyPopupBox = await currencyPopup.boundingBox();
    expect(currencyPopupBox).not.toBeNull();
    expect(currencyPopupBox!.x).toBeGreaterThanOrEqual(0);
    expect(currencyPopupBox!.x + currencyPopupBox!.width).toBeLessThanOrEqual(width);
  });
}
