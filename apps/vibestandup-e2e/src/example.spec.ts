import { test, expect } from '@playwright/test';

test('shows the Vibe Standup home page', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: 'Async standups without the meeting.',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Start a draft' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible();
});
