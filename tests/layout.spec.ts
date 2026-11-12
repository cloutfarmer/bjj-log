import { test, expect } from '@playwright/test';

for (const width of [390, 1100]) {
  test(`journal layout and import eligibility at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const cloud = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`2026-10-${20+i}`, { text: `Note ${i}`, sessionTypes: ['class'], attire: 'gi', version: `202610${20+i}120000000000` }]));
    await page.route('**/api/entries', route => route.fulfill({ json: cloud }));
    // Tags answer "unavailable", so the test reads and changes no tag data.
    await page.route('**/api/ai/**', route => route.fulfill({ status: 503, json: {} }));
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

    // Each screen has its own URL, and moving between them keeps the selected day.
    const nav = page.getByRole('navigation', { name: 'Main' });
    await page.getByRole('button', { name: /Oct 22, 2026/ }).click();
    await expect(page.getByRole('heading', { name: 'Thursday, October 22, 2026' })).toBeVisible();
    for (const [name, path] of [['Calendar', '/calendar'], ['Tags', '/tags'], ['Untagged', '/untagged']] as const) {
      await nav.getByRole('link', { name }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(nav.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
      await expect(page.getByRole('heading', { name: 'Recent entries' })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await nav.getByRole('link', { name: 'Calendar' }).click();
    await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible();
    await page.getByRole('button', { name: '24', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Saturday, October 24, 2026' })).toBeVisible();
    await nav.getByRole('link', { name: 'Tags' }).click();
    await nav.getByRole('link', { name: 'Journal' }).click();
    await expect(page.getByRole('heading', { name: 'Saturday, October 24, 2026' })).toBeVisible();
  });
}
