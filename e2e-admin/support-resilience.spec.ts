import { expect, test } from '@playwright/test';
import { armFetchFault, installFetchFaultHarness } from './helpers/fetch-fault.js';
import { enrollAdmin, spaNavigate } from './helpers/admin-session.js';

test.beforeEach(async ({ context }) => installFetchFaultHarness(context));

test('support unknown outcomes preserve the frozen request until an exact retry succeeds', async ({ page }) => {
    test.setTimeout(90_000);
    await enrollAdmin(page);

    await spaNavigate(page, '/admin/support');
    await page.getByText('Начать новое обращение', { exact: true }).click();
    const create = page.getByText('Начать новое обращение', { exact: true }).locator('xpath=ancestor::details[1]');
    await create.getByLabel('UUID пользователя').fill('10000000-0000-4000-8000-000000000002');
    await create.getByLabel('Тема').fill('E2E неизвестный исход');
    await create.getByLabel('Сообщение').fill('Проверка безопасного повтора создания');
    await armFetchFault(page, { path: '/api/v1/admin/support/create', method: 'POST', status: 503 });
    await create.getByRole('button', { name: 'Создать обращение', exact: true }).click();
    await expect(create.getByRole('alert')).toContainText('Исход создания обращения неизвестен');
    await create.getByLabel('Тема').fill('Изменённая тема');
    await create.getByRole('button', { name: 'Создать обращение', exact: true }).click();
    await expect(create.getByRole('alert')).toContainText('Повторите прежний запрос');
    await create.getByLabel('Тема').fill('E2E неизвестный исход');
    await create.getByRole('button', { name: 'Создать обращение', exact: true }).click();
    await expect(create.getByRole('link', { name: 'Открыть созданное обращение', exact: true })).toBeVisible();

    const ticketId = '10000000-0000-4000-8000-000000000005';
    await spaNavigate(page, `/admin/support/${ticketId}`);
    const workspace = page.getByRole('heading', { name: 'Работа с обращением' }).locator('xpath=ancestor::section[1]');
    await workspace.getByLabel('Действие').selectOption('note');
    await workspace.getByLabel('Текст').fill('E2E заметка с неизвестным исходом');
    await armFetchFault(page, {
        path: `/api/v1/admin/support/${ticketId}/manage`,
        method: 'POST',
        status: 503,
    });
    await workspace.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(workspace.getByRole('status')).toContainText('Исход операции неизвестен');
    await workspace.getByLabel('Текст').fill('Изменённая заметка');
    await workspace.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(workspace.getByRole('status')).toContainText('Сначала повторите прежнюю операцию');
    await workspace.getByLabel('Текст').fill('E2E заметка с неизвестным исходом');
    await workspace.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(workspace.getByRole('status')).toContainText('Сохранено');

    const reply = page.getByLabel('Ответ пользователю');
    await reply.fill('E2E ответ с неизвестным исходом');
    await armFetchFault(page, {
        path: `/api/v1/admin/support/${ticketId}/reply`,
        method: 'POST',
        status: 503,
    });
    await page.getByRole('button', { name: 'Отправить ответ', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Исход запроса неизвестен' })).toBeVisible();
    await reply.fill('Изменённый ответ');
    await page.getByRole('button', { name: 'Отправить ответ', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Сначала повторите его с прежним текстом' })).toBeVisible();
    await reply.fill('E2E ответ с неизвестным исходом');
    await page.getByRole('button', { name: 'Отправить ответ', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Ответ сохранён' })).toBeVisible();
});

test('support conflict refreshes the whole ticket before the form is unlocked for retry', async ({ page }) => {
    await enrollAdmin(page);
    const ticketId = '10000000-0000-4000-8000-000000000005';
    await spaNavigate(page, `/admin/support/${ticketId}`);

    const workspace = page.getByRole('heading', { name: 'Работа с обращением' }).locator('xpath=ancestor::section[1]');
    await workspace.getByLabel('Действие').selectOption('note');
    await workspace.getByLabel('Текст').fill('E2E заметка после конфликта');
    await armFetchFault(page, {
        path: `/api/v1/admin/support/${ticketId}/manage`,
        method: 'POST',
        status: 409,
    });
    const save = workspace.getByRole('button', { name: 'Сохранить', exact: true });
    await save.click();
    await expect(workspace.getByRole('status')).toContainText('Данные обновлены');
    await expect(save).toBeEnabled();
    await save.click();
    await expect(workspace.getByRole('status')).toContainText('Сохранено');

    const reply = page.getByLabel('Ответ пользователю');
    await reply.fill('E2E ответ после конфликта');
    await armFetchFault(page, {
        path: `/api/v1/admin/support/${ticketId}/reply`,
        method: 'POST',
        status: 409,
    });
    await page.getByRole('button', { name: 'Отправить ответ', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Обращение изменилось' })).toBeVisible();
    await page.getByRole('button', { name: 'Отправить ответ', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Ответ сохранён' })).toBeVisible();
});
