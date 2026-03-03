import { expect, test } from '@playwright/test';

test('topology filter panel toggles and applies selections', async ({ page }) => {
  await page.route('**/projects', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(['project-a']),
    });
  });

  await page.route('**/entities?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          { id: 'dev-1', projectId: 'project-a', entityType: 'Device', name: 'Device 1', status: 'ON' },
          { id: 'gw-1', projectId: 'project-a', entityType: 'Gateway', name: 'Gateway 1', status: 'OFF' },
        ],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      }),
    });
  });

  await page.route('**/relationships?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{ source_id: 'dev-1', target_id: 'gw-1', rel_type: 'DEPENDS_ON', props: {} }],
        total: 1,
        page: 1,
        size: 500,
        pages: 1,
      }),
    });
  });

  await page.goto('/topology');

  await expect(page.getByTitle('Filters')).toBeVisible();
  await page.getByTitle('Filters').click();

  await expect(page.getByText('Filters')).toBeVisible();

  const typeSelect = page.getByLabel('Filter by entity type');
  const statusSelect = page.getByLabel('Filter by entity status');

  await typeSelect.selectOption('Gateway');
  await statusSelect.selectOption('OFF');

  await expect(typeSelect).toHaveValue('Gateway');
  await expect(statusSelect).toHaveValue('OFF');

  await page.getByTitle('Filters').click();
  await expect(page.getByText('Filters')).not.toBeVisible();
});
