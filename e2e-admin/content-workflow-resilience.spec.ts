import { expect, test, type Locator, type Page } from '@playwright/test';
import { armFetchFault, installFetchFaultHarness } from './helpers/fetch-fault.js';
import { confirmCritical, enrollAdmin, spaNavigate } from './helpers/admin-session.js';

const catalogId = '10000000-0000-4000-8000-000000000007';

test.beforeEach(async ({ context }) => installFetchFaultHarness(context));

test('catalog builds a complete preview and merges into the canonical card with an alias', async ({ page }) => {
    const recoveryCodes = await enrollAdmin(page);
    const workspace = await openCatalog(page);
    await chooseCandidateAndResolve(workspace);
    await workspace.getByLabel('Основная карточка').selectOption({ label: 'Молоко 2,5% · кандидат' });
    await workspace.getByRole('button', { name: 'Предпросмотр объединения', exact: true }).click();
    await expect(workspace.getByRole('heading', { name: 'Итог и последствия', exact: true })).toBeVisible();
    await workspace.getByLabel('Причина действия').fill('E2E: подтверждённый дубль');
    await confirmCritical(page, recoveryCodes[0]!, workspace);
    await workspace.getByRole('button', { name: 'Подтвердить объединение', exact: true }).click();
    await expect(workspace.getByText(/Карточки объединены/u)).toBeVisible();
    await expect(workspace.getByText(`Эта карточка объединена с 10000000-0000-4000-8000-000000000107.`)).toBeVisible();
    await expect(workspace.getByText('Внутренняя история решений (1)', { exact: true })).toBeVisible();
});

test('not-duplicate unknown outcome only permits exact replay and closes the exact pair once', async ({ page }) => {
    await enrollAdmin(page);
    const workspace = await openCatalog(page);
    await chooseCandidateAndResolve(workspace);
    const reason = workspace.getByLabel('Причина действия');
    await reason.fill('E2E: товары различаются');
    await armFetchFault(page, {
        path: `/api/v1/admin/content-workspace/catalog/${catalogId}/not-duplicate`,
        method: 'POST',
        status: 503,
        commitBeforeFailure: true,
    });
    await workspace.getByRole('button', { name: 'Это не дубли', exact: true }).click();
    await expect(workspace.getByRole('alert')).toContainText('Исход команды неизвестен');
    await reason.fill('E2E: изменённое решение блокируется');
    await workspace.getByRole('button', { name: 'Это не дубли', exact: true }).click();
    await expect(workspace.getByRole('alert')).toContainText('Сначала повторите её без изменений');
    await workspace.getByRole('button', { name: 'Повторить прежнюю команду', exact: true }).click();
    await expect(workspace.getByText('Внутренняя история решений (1)', { exact: true })).toBeVisible();
    await workspace.getByRole('button', { name: 'Предпросмотр объединения', exact: true }).click();
    await expect(workspace.getByRole('alert')).toContainText('Данные изменились');
    await expect(workspace.getByText('Внутренняя история решений (1)', { exact: true })).toBeVisible();
});

test('merge exact replay survives expired critical confirmation and re-confirmation', async ({ page }) => {
    const recoveryCodes = await enrollAdmin(page);
    const workspace = await openCatalog(page);
    await chooseCandidateAndResolve(workspace);
    await workspace.getByRole('button', { name: 'Предпросмотр объединения', exact: true }).click();
    await workspace.getByLabel('Причина действия').fill('E2E: replay после повторного подтверждения');
    await confirmCritical(page, recoveryCodes[0]!, workspace);
    await armFetchFault(page, {
        path: `/api/v1/admin/content-workspace/catalog/${catalogId}/merge`,
        method: 'POST',
        status: 503,
        commitBeforeFailure: true,
    });
    await workspace.getByRole('button', { name: 'Подтвердить объединение', exact: true }).click();
    await expect(workspace.getByRole('alert')).toContainText('Исход команды неизвестен');

    await expireCriticalConfirmation(page);
    await workspace.getByRole('button', { name: 'Повторить прежнюю команду', exact: true }).click();
    await expect(workspace.getByRole('alert')).toContainText('Критичное подтверждение отсутствует или истекло');
    await expect(workspace.getByRole('button', { name: 'Повторить прежнюю команду', exact: true })).toBeVisible();

    const recoveryInput = workspace.getByLabel('Резервный код подтверждения', { exact: true });
    await expect(recoveryInput).toBeVisible();
    await recoveryInput.fill(recoveryCodes[1]!);
    await workspace.getByRole('button', { name: 'Подтвердить критичные действия', exact: true }).click();
    await expect(workspace.getByRole('status').filter({ hasText: 'Действия подтверждены до' })).toBeVisible();
    await workspace.getByRole('button', { name: 'Повторить прежнюю команду', exact: true }).click();
    await expect(workspace.getByText(/Карточки объединены/u)).toBeVisible();
    await expect(workspace.getByText('Внутренняя история решений (1)', { exact: true })).toBeVisible();
    await spaNavigate(page, '/admin/audit');
    await expect(page.getByRole('heading', { name: 'admin.content.merge', exact: true })).toHaveCount(1);
});

test('ordinary merge 403 reports access denial without misleading TOTP and preserves exact retry', async ({ page }) => {
    const recoveryCodes = await enrollAdmin(page);
    const workspace = await openCatalog(page);
    await chooseCandidateAndResolve(workspace);
    await workspace.getByRole('button', { name: 'Предпросмотр объединения', exact: true }).click();
    await workspace.getByLabel('Причина действия').fill('E2E: роль временно не разрешает merge');
    await confirmCritical(page, recoveryCodes[0]!, workspace);
    await armFetchFault(page, {
        path: `/api/v1/admin/content-workspace/catalog/${catalogId}/merge`,
        method: 'POST',
        status: 403,
    });
    await workspace.getByRole('button', { name: 'Подтвердить объединение', exact: true }).click();
    const alert = workspace.getByRole('alert');
    await expect(alert).toContainText('Операция запрещена текущей ролью или разрешениями');
    await expect(alert).toContainText('повторный TOTP не поможет');
    await expect(alert).not.toContainText('Критичное подтверждение отсутствует или истекло');
    await expect(workspace.getByRole('status').filter({ hasText: 'Действия подтверждены до' })).toBeVisible();
    await expect(workspace.getByRole('button', { name: 'Повторить прежнюю команду', exact: true })).toBeVisible();

    await workspace.getByRole('button', { name: 'Повторить прежнюю команду', exact: true }).click();
    await expect(workspace.getByText(/Карточки объединены/u)).toBeVisible();
    await expect(workspace.getByText('Внутренняя история решений (1)', { exact: true })).toBeVisible();
    await spaNavigate(page, '/admin/audit');
    await expect(page.getByRole('heading', { name: 'admin.content.merge', exact: true })).toHaveCount(1);
});

async function openCatalog(page: Page) {
    await spaNavigate(page, `/admin/catalog/${catalogId}`);
    const workspace = page
        .getByRole('heading', { name: 'Сравнение и объединение дублей', exact: true })
        .locator('xpath=ancestor::section[1]');
    await expect(workspace).toBeVisible();
    return workspace;
}

async function chooseCandidateAndResolve(workspace: Locator) {
    await workspace.getByLabel('Кандидат для сравнения').selectOption({ label: 'Молоко 2,5% · кандидат' });
    await workspace.getByLabel('Итог поля name').selectOption('left');
}

async function expireCriticalConfirmation(page: Page) {
    await page.evaluate(
        () =>
            new Promise<void>((resolve, reject) => {
                const opening = indexedDB.open('meal-planner-admin-api-v1-mock', 1);
                opening.onerror = () => reject(new Error('Cannot open mock storage'));
                opening.onsuccess = () => {
                    const database = opening.result;
                    const transaction = database.transaction('state', 'readwrite');
                    const store = transaction.objectStore('state');
                    const reading = store.get('current');
                    reading.onerror = () => reject(new Error('Cannot read mock storage'));
                    reading.onsuccess = () => {
                        const state = reading.result as { sessions: { criticalConfirmedUntil?: string }[] };
                        for (const session of state.sessions) delete session.criticalConfirmedUntil;
                        store.put(state, 'current');
                    };
                    transaction.oncomplete = () => {
                        database.close();
                        resolve();
                    };
                    transaction.onabort = () => reject(new Error('Cannot update mock storage'));
                };
            }),
    );
}
