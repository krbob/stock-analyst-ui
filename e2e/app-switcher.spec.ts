import { expect, test } from '@playwright/test';

test.use({ locale: 'pl-PL' });

test('exposes a keyboard-safe Portfolio hand-off without leaking analysis state', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark');
    (window as Window & { __STOCK_ANALYST_CONFIG__?: { portfolioUrl?: string } })
      .__STOCK_ANALYST_CONFIG__ = {
        portfolioUrl: 'https://portfolio.example/app?tenant=personal',
      };
  });
  await page.goto('/?s=AAPL&p=5y&cur=PLN');

  const switcher = page.getByRole('link', { name: 'Open Portfolio application' });
  await expect(switcher).toBeVisible();
  await expect(switcher).toContainText('Portfolio');
  await expect(switcher).toHaveAttribute(
    'href',
    'https://portfolio.example/app?tenant=personal&uiTheme=dark&uiLocale=pl-PL',
  );
  await expect(switcher).not.toHaveAttribute('href', /AAPL|PLN|5y/);

  await switcher.focus();
  await expect(switcher).toBeFocused();

  await page.getByRole('button', { name: /dark theme active/i }).click();
  await expect(switcher).toHaveAttribute(
    'href',
    'https://portfolio.example/app?tenant=personal&uiTheme=system&uiLocale=pl-PL',
  );

  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(layout.documentWidth).toBe(layout.viewportWidth);
});
