import { expect, test } from '@playwright/test';
import { expectNoWcagViolations } from './support/accessibility';
import { mockMarketData } from './support/market-data';

test.beforeEach(async ({ page }) => {
  await mockMarketData(page);
});

test('single-stock analysis meets WCAG AA and supports a keyboard-only core workflow', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?s=AAPL&p=1y');

  await expect(page.getByRole('img', { name: 'AAPL price chart' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'AAPL market data provenance' })).toBeVisible();
  await expectNoWcagViolations(page, 'Single-stock analysis');

  const ticker = page.getByRole('combobox', { name: 'Search ticker' });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let tab = 0; tab < 5 && !(await ticker.evaluate((element) => element === document.activeElement)); tab += 1) {
    await page.keyboard.press('Tab');
  }
  await expect(ticker).toBeFocused();

  await page.keyboard.type('MSFT');
  await expect(page.getByRole('option', { name: /MSFT.*Microsoft Corporation/ })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/[?&]s=MSFT(?:&|$)/);
  await expect(page.getByRole('img', { name: 'MSFT price chart' })).toBeVisible();

  const currency = page.getByRole('button', { name: 'Select currency' });
  await currency.focus();
  await page.keyboard.press('Enter');
  const currencySearch = page.getByRole('textbox', { name: 'Search currency' });
  await expect(currencySearch).toBeFocused();
  await page.keyboard.type('EUR');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(currency).toBeFocused();
  await expect(currency).toContainText('EUR');
});

test('comparison view meets WCAG AA and its mode controls work from the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?cmp=AAPL,MSFT&p=1y');

  await expect(page.getByRole('img', { name: 'Percentage comparison chart for AAPL, MSFT' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Scrollable stock comparison table' })).toBeVisible();
  await expectNoWcagViolations(page, 'Comparison analysis');

  const periods = page.getByRole('radiogroup', { name: 'Time period' });
  const oneYear = periods.getByRole('radio', { name: '1Y' });
  await oneYear.focus();
  await page.keyboard.press('ArrowRight');
  await expect(periods.getByRole('radio', { name: '5Y' })).toBeChecked();
  await expect(page).toHaveURL(/[?&]p=5y(?:&|$)/);

  const exit = page.getByRole('button', { name: 'Exit comparison mode' });
  await exit.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('img', { name: 'AAPL price chart' })).toBeVisible();
});
