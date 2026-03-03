import { expect, test } from '@playwright/test';

test('outbox refresh updates counters and failed event row', async ({ page }) => {
  let statsCallCount = 0;
  let outboxCallCount = 0;

  await page.route('**/projects', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(['project-a']) });
  });

  await page.route('**/outbox/stats?*', async (route) => {
    statsCallCount += 1;
    const payload = statsCallCount === 1
      ? { PENDING: 2, DONE: 5, FAILED: 0 }
      : { PENDING: 1, DONE: 6, FAILED: 1 };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });

  await page.route('**/outbox?*', async (route) => {
    outboxCallCount += 1;
    const baseItem = {
      id: 'evt-1',
      event_id: 1,
      status: 'DONE',
      created_at: '2026-02-27T01:00:00.000Z',
      processed_at: '2026-02-27T01:00:01.000Z',
      error_message: null,
      event_type: 'EntityCreated',
      actor: 'api',
      payload: { project_id: 'project-a', entity_id: 'dev-1' },
    };

    const failedItem = {
      id: 'evt-2',
      event_id: 2,
      status: 'FAILED',
      created_at: '2026-02-27T01:01:00.000Z',
      processed_at: '2026-02-27T01:01:02.000Z',
      error_message: 'Projection timeout',
      event_type: 'RelationshipEstablished',
      actor: 'api',
      payload: { project_id: 'project-a', from_id: 'dev-1', to_id: 'gw-1' },
    };

    const items = outboxCallCount === 1 ? [baseItem] : [failedItem, baseItem];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items }) });
  });

  await page.goto('/outbox');

  await expect(page.getByRole('heading', { name: 'Event Pipeline Monitoring' })).toBeVisible();
  await expect(page.getByText('Pending (In Queue)')).toBeVisible();
  await expect(page.locator('p.text-4xl').first()).toHaveText('2');

  await page.getByRole('button', { name: 'Refresh' }).click();

  await expect(page.getByText('Projection timeout')).toBeVisible();
  await expect(page.getByText('FAILED', { exact: true })).toBeVisible();
});
