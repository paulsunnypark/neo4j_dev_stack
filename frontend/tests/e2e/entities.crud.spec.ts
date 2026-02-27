import { expect, test } from '@playwright/test';

type EntityItem = {
  id: string;
  projectId: string;
  entityType: string;
  name: string;
  status: string;
};

test('entities CRUD flow works with mocked API', async ({ page }) => {
  let entities: EntityItem[] = [
    {
      id: 'dev-1',
      projectId: 'project-a',
      entityType: 'Device',
      name: 'Device One',
      status: 'ON',
    },
  ];

  await page.route('**/projects', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(['project-a']) });
  });

  await page.route('**/entities?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: entities,
        total: entities.length,
        page: 1,
        size: 100,
        pages: 1,
      }),
    });
  });

  await page.route('**/entities', async (route, request) => {
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as { entity_id: string; entity_type: string; name?: string; project_id: string };
      entities.push({
        id: body.entity_id,
        projectId: body.project_id,
        entityType: body.entity_type,
        name: body.name || body.entity_id,
        status: 'UNKNOWN',
      });

      await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ event_id: 1001, note: 'Queued for projection' }) });
      return;
    }

    await route.continue();
  });

  await page.route('**/entities/*/attributes', async (route, request) => {
    const body = request.postDataJSON() as { entity_id: string; attribute_key: string; new_value: string };
    entities = entities.map((entity) => {
      if (entity.id !== body.entity_id) return entity;
      if (body.attribute_key === 'name') {
        return { ...entity, name: body.new_value };
      }
      return entity;
    });

    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ event_id: 1002, note: 'Queued for projection' }) });
  });

  await page.route('**/entities/*/status', async (route, request) => {
    const body = request.postDataJSON() as { entity_id: string; new_status: string };
    entities = entities.map((entity) =>
      entity.id === body.entity_id ? { ...entity, status: body.new_status } : entity
    );

    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ event_id: 1003, note: 'Queued for projection' }) });
  });

  await page.route('**/entities/*', async (route, request) => {
    if (request.method() === 'DELETE') {
      const url = new URL(request.url());
      const id = url.pathname.split('/').pop() || '';
      entities = entities.filter((entity) => entity.id !== id);
      await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ event_id: 1004, note: 'Queued for projection' }) });
      return;
    }

    await route.continue();
  });

  await page.route('**/relationships', async (route, request) => {
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, size: 500, pages: 1 }),
      });
      return;
    }

    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ event_id: 1005, note: 'Queued for projection' }) });
  });

  await page.goto('/entities');

  await expect(page.getByRole('heading', { name: 'Entity Manager' })).toBeVisible();
  await expect(page.getByText('Device One')).toBeVisible();

  await page.getByRole('button', { name: /Add Entity/i }).click();
  await page.getByPlaceholder('e.g. Room_2_Light_1').fill('dev-2');
  await page.getByPlaceholder('Optional human readable name').fill('Device Two');
  await page.getByRole('button', { name: 'Create Entity', exact: true }).click();

  await expect(page.getByText('Device Two')).toBeVisible();

  await page.getByRole('button', { name: 'Edit entity dev-2' }).click();
  const editDialog = page.getByRole('heading', { name: 'Edit Entity: dev-2' });
  await expect(editDialog).toBeVisible();
  await page.locator('input[value="Device Two"]').fill('Device Two Edited');
  await page.locator('form select').last().selectOption('OFF');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.getByText('Device Two Edited')).toBeVisible();
  await expect(page.getByText('OFF')).toBeVisible();

  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete entity dev-2' }).click();

  await expect(page.getByText('Device Two Edited')).not.toBeVisible();
});
