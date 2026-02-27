import { expect, test } from '@playwright/test';

test('app shell loads and shows primary navigation', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('NEO:STACK')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'System Overview' })).toBeVisible();
});
