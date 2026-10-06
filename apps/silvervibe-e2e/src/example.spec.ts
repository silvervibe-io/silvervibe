import { test, expect } from '@playwright/test';

test('shows the Silvervibe home page', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Silvervibe' })).toBeVisible();
});
