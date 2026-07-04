import { test, type Page } from '@playwright/test';

test.use({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'dark',
  deviceScaleFactor: 2,
});

const SCREENSHOT_DIR = './docs';

async function waitForChart(page: Page) {
  // Wait for all loading spinners to disappear (data loaded)
  await page.waitForFunction(
    () => document.querySelectorAll('.animate-spin').length === 0,
    { timeout: 30_000 },
  );
  // Wait for a visible canvas (chart rendered with data)
  await page.locator('canvas >> visible=true').first().waitFor({ timeout: 10_000 });
  // Let chart animations settle
  await page.waitForTimeout(1_000);
}

test.describe.serial('generate README screenshots', () => {

  test('main view — AAPL 1Y with SMA', async ({ page }) => {
    await page.goto('/?s=AAPL&p=1y&ind=sma50,sma200');
    await waitForChart(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/screenshot-main.png`, fullPage: false });
  });

  test('indicators — AAPL 5D line with BB, RSI, MACD', async ({ page }) => {
    await page.goto('/?s=AAPL&p=5d&i=15m&line=1&ind=bb,rsi,macd');
    await waitForChart(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/screenshot-indicators.png`, fullPage: false });
  });

  test('compare mode — AAPL vs MSFT vs INTC 5Y', async ({ page }) => {
    await page.goto('/?s=INTC&cmp=AAPL,MSFT,INTC&p=5y');
    await waitForChart(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/screenshot-compare.png`, fullPage: false });
  });

  test('dividends — KO 5Y with dividend markers', async ({ page }) => {
    await page.goto('/?s=KO&p=5y&div=1');
    await waitForChart(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/screenshot-dividends.png`, fullPage: false });
  });
});

test.describe.serial('generate README screenshots (light theme)', () => {
  test.use({ colorScheme: 'light' });

  test('light theme — MSFT 1Y with EMA', async ({ page }) => {
    await page.goto('/?s=MSFT&p=1y&ind=ema50,ema200');
    await waitForChart(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/screenshot-light.png`, fullPage: false });
  });
});
