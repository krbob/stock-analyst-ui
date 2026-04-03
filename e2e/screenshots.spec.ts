import { expect, test, type Page } from '@playwright/test';

test.use({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'dark',
  deviceScaleFactor: 2,
});

const SCREENSHOT_DIR = './docs';

async function waitForChart(page: Page) {
  // Wait for a visible canvas (chart rendered with data)
  await page.locator('canvas >> visible=true').first().waitFor({ timeout: 20_000 });
  // Let remaining data settle (compare table, indicators)
  await page.waitForTimeout(2_000);
}

test.describe.serial('generate README screenshots', () => {

  test('main view — AAPL 1Y with SMA', async ({ page }) => {
    await page.goto('/?s=AAPL&p=1y&ind=sma50,sma200');
    await waitForChart(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/screenshot-main.png`, fullPage: true });
  });

  test('indicators — AAPL 5D line with BB, RSI, MACD', async ({ page }) => {
    await page.goto('/?s=AAPL&p=5d&i=15m&line=1&ind=bb,rsi,macd');
    await waitForChart(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/screenshot-indicators.png`, fullPage: false });
  });

  test('compare mode — AAPL vs MSFT vs INTC 5Y', async ({ page }) => {
    await page.goto('/?s=INTC&cmp=AAPL,MSFT,INTC&p=5y');
    await waitForChart(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/screenshot-compare.png`, fullPage: true });
  });
});
