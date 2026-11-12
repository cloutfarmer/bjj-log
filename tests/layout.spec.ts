import { test, expect } from '@playwright/test';

for (const width of [390, 1100]) {
  test(`journal layout and import eligibility at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const cloud = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`2026-10-${20+i}`, { text: `Note ${i}`, sessionTypes: ['class'], attire: 'gi', version: `202610${20+i}120000000000` }]));
    await page.route('**/api/entries', route => route.fulfill({ json: cloud }));
    await page.goto('/');
    if (await page.getByLabel('Your private journal password').isVisible()) {
      await page.getByLabel('Your private journal password').fill(process.env.BJJ_PASSWORD!);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    }
    await expect(page.getByRole('heading', { name: 'Recent entries' })).toBeVisible();
    await page.evaluate(notes => localStorage.setItem('bjj-log-entries', JSON.stringify(notes)), cloud);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Recent entries' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import browser notes' })).toHaveCount(0);
    await page.evaluate(() => localStorage.setItem('bjj-log-entries', JSON.stringify({ '2026-01-01': 'Missing note', '2026-01-02': '   ', invalid: 'Ignore' })));
    await page.reload();
    await expect(page.getByText('1 browser note is missing', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show more', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Show more', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Show more', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const date = page.getByRole('button', { name: 'Previous week' });
    await expect(date).toBeVisible();
  });
}
