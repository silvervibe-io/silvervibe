import { test, expect } from '@playwright/test';

test('shows the standup form', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Vibe Standup' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible();
});
