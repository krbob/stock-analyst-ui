import { expect, test } from '@playwright/test';
import { expectNoWcagViolations } from './support/accessibility';

test('reloads a query-string navigation from the cached app shell while offline', async ({ context, page }) => {
  await page.goto('/?s=AAPL&p=1y');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
      });
    }
  });

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Stock Analyst' })).toBeVisible();
    await expect(page).toHaveURL(/[?&]s=AAPL(?:&|$)/);
    await expectNoWcagViolations(page, 'Offline app shell');
  } finally {
    await context.setOffline(false);
  }
});
