import { expect, test } from '@playwright/test';
import { armFetchFault, installFetchFaultHarness } from './helpers/fetch-fault.js';
import { confirmCritical, enrollAdmin, spaNavigate } from './helpers/admin-session.js';

const userId = '10000000-0000-4000-8000-000000000007';

test.beforeEach(async ({ context }) => installFetchFaultHarness(context));

test('governance unknown outcome only permits exact retry and conflict requires a new preview', async ({ page }) => {
    test.setTimeout(90_000);
    const codes = await enrollAdmin(page);
    await spaNavigate(page, `/admin/users/${userId}`);
    const governance = page
        .getByRole('heading', { name: 'Санкции и служебные права' })
        .locator('xpath=ancestor::section[1]');
    await governance.getByLabel('Действие').selectOption('grantModerator');
    await confirmCritical(page, codes[0]!, governance);
    const reason = governance.getByLabel('Причина действия');
    await reason.fill('E2E governance exact retry');
    await governance.getByRole('button', { name: 'Проверить последствия', exact: true }).click();
    await governance.getByRole('checkbox', { name: 'Подтверждаю указанные последствия' }).check();
    await armFetchFault(page, {
        path: `/api/v1/admin/governance/users/${userId}`,
        method: 'POST',
        status: 503,
    });
    await governance.getByRole('button', { name: 'Выполнить', exact: true }).click();
    await expect(governance.getByRole('status').filter({ hasText: 'Исход действия неизвестен' })).toBeVisible();

    await reason.fill('Изменённый governance intent');
    await governance.getByRole('button', { name: 'Проверить последствия', exact: true }).click();
    await governance.getByRole('checkbox', { name: 'Подтверждаю указанные последствия' }).check();
    await governance.getByRole('button', { name: 'Выполнить', exact: true }).click();
    await expect(governance.getByRole('status').filter({ hasText: 'Повторите прежнее действие' })).toBeVisible();

    await reason.fill('E2E governance exact retry');
    await governance.getByRole('button', { name: 'Проверить последствия', exact: true }).click();
    await governance.getByRole('checkbox', { name: 'Подтверждаю указанные последствия' }).check();
    await governance.getByRole('button', { name: 'Выполнить', exact: true }).click();
    await expect(governance.getByRole('status').filter({ hasText: 'Действие сохранено' })).toBeVisible();

    await reason.fill('E2E governance conflict refresh');
    await governance.getByRole('button', { name: 'Проверить последствия', exact: true }).click();
    await governance.getByRole('checkbox', { name: 'Подтверждаю указанные последствия' }).check();
    await armFetchFault(page, {
        path: `/api/v1/admin/governance/users/${userId}`,
        method: 'POST',
        status: 409,
    });
    await governance.getByRole('button', { name: 'Выполнить', exact: true }).click();
    await expect(governance.getByRole('status').filter({ hasText: 'изменились и обновлены' })).toBeVisible();
    await expect(governance.getByRole('region', { name: 'Последствия действия' })).toHaveCount(0);
    await expect(governance.getByRole('button', { name: 'Проверить последствия', exact: true })).toBeEnabled();
});

test('Free AI grant reads back exact retry and resets confirmation after conflict', async ({ page }) => {
    test.setTimeout(90_000);
    const codes = await enrollAdmin(page);
    await spaNavigate(page, `/admin/users/${userId}`);
    const freeAi = page.getByRole('heading', { name: 'AI-квота Free' }).locator('xpath=ancestor::section[1]');
    const available = freeAi
        .getByText('действий доступно', { exact: true })
        .locator('xpath=preceding-sibling::strong[1]');
    const availableBefore = Number(await available.textContent());
    expect(Number.isFinite(availableBefore)).toBe(true);
    await confirmCritical(page, codes[0]!, freeAi);
    await freeAi.getByLabel('Количество действий').fill('23');
    const reason = freeAi.getByLabel('Причина');
    await reason.fill('E2E Free AI exact retry');
    await freeAi.getByRole('button', { name: 'Проверить выдачу', exact: true }).click();
    await freeAi.getByRole('checkbox', { name: 'Данные проверены' }).check();
    await armFetchFault(page, {
        path: `/api/v1/admin/free-ai/users/${userId}/grants`,
        method: 'POST',
        status: 503,
    });
    await freeAi.getByRole('button', { name: 'Выдать квоту', exact: true }).click();
    await expect(freeAi.getByRole('status').filter({ hasText: 'Исход выдачи неизвестен' })).toBeVisible();

    await reason.fill('Изменённый Free AI intent');
    await freeAi.getByRole('button', { name: 'Проверить выдачу', exact: true }).click();
    await freeAi.getByRole('checkbox', { name: 'Данные проверены' }).check();
    await freeAi.getByRole('button', { name: 'Выдать квоту', exact: true }).click();
    await expect(freeAi.getByRole('status').filter({ hasText: 'Сначала повторите прежний запрос' })).toBeVisible();

    await reason.fill('E2E Free AI exact retry');
    await freeAi.getByRole('button', { name: 'Проверить выдачу', exact: true }).click();
    await freeAi.getByRole('checkbox', { name: 'Данные проверены' }).check();
    await freeAi.getByRole('button', { name: 'Выдать квоту', exact: true }).click();
    await expect(freeAi.getByRole('status').filter({ hasText: 'Выдано 23 действий' })).toBeVisible();
    await expect(available).toHaveText(String(availableBefore + 23));
    await page.reload();
    await expect(freeAi).toBeVisible();
    await expect(available).toHaveText(String(availableBefore + 23));

    await freeAi.getByLabel('Количество действий').fill('1');
    await reason.fill('E2E Free AI conflict refresh');
    await freeAi.getByRole('button', { name: 'Проверить выдачу', exact: true }).click();
    await freeAi.getByRole('checkbox', { name: 'Данные проверены' }).check();
    await armFetchFault(page, {
        path: `/api/v1/admin/free-ai/users/${userId}/grants`,
        method: 'POST',
        status: 409,
    });
    await freeAi.getByRole('button', { name: 'Выдать квоту', exact: true }).click();
    await expect(freeAi.getByRole('status').filter({ hasText: 'изменились и обновлены' })).toBeVisible();
    await expect(freeAi.getByRole('region', { name: 'Предпросмотр выдачи AI-квоты' })).toHaveCount(0);
    await expect(freeAi.getByRole('button', { name: 'Проверить выдачу', exact: true })).toBeEnabled();
});
