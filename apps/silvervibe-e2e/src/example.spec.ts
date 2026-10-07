import { test, expect } from '@playwright/test';

test('shows the Silver Vibe landing page', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'A better vibe for async work.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Source on GitHub' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'info@silvervibe.io' }),
  ).toBeVisible();
});
