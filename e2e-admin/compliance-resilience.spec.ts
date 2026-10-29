import { expect, test } from '@playwright/test';
import { activate, confirmCritical, enrollAdmin, spaNavigate } from './helpers/admin-session.js';
import { armFetchFault, installFetchFaultHarness } from './helpers/fetch-fault.js';

const rollbackId = '10000000-0000-4000-8000-000000000011';
const deletionId = '20000000-0000-4000-8000-000000000070';

test.beforeEach(async ({ context }) => installFetchFaultHarness(context));

test('rollback replays the exact frozen command after a lost committed response', async ({ page }) => {
    test.setTimeout(90_000);
    const codes = await enrollAdmin(page);
    await spaNavigate(page, `/admin/rollback/${rollbackId}`);
    const review = page
        .getByRole('heading', { name: 'Предпросмотр компенсирующего отката', exact: true })
        .locator('xpath=ancestor::section[1]');
    await activate(review.getByRole('button', { name: 'Обновить предпросмотр последствий', exact: true }));
    await confirmCritical(page, codes[0]!, review);
    const reason = review.getByLabel('Причина действия');
    const execute = review.getByRole('button', { name: 'Компенсировать только готовые элементы', exact: true });
    await reason.fill('E2E rollback exact retry');
    await armFetchFault(page, {
        path: `/api/v1/admin/review-workspace/rollback/${rollbackId}/apply-rollback`,
        method: 'POST',
        status: 503,
        commitBeforeFailure: true,
    });
    await activate(execute);
    await expect(review.getByRole('alert')).toContainText('Исход команды неизвестен');
    await expect(review.getByRole('button', { name: 'Обновить предпросмотр последствий', exact: true })).toBeDisabled();

    await reason.fill('Изменённый rollback intent');
    await activate(execute);
    await expect(review.getByRole('alert')).toContainText('Сначала повторите её без изменений');

    await reason.fill('E2E rollback exact retry');
    await activate(execute);
    await expect(review.getByRole('status').filter({ hasText: 'Компенсировано:' })).toBeVisible();
    await expect(review.getByText('История (1)', { exact: true })).toBeVisible();
});

test('rollback conflict waits for readback and requires a new preview', async ({ page }) => {
    const codes = await enrollAdmin(page);
    await spaNavigate(page, `/admin/rollback/${rollbackId}`);
    const review = page
        .getByRole('heading', { name: 'Предпросмотр компенсирующего отката', exact: true })
        .locator('xpath=ancestor::section[1]');
    const preview = review.getByRole('button', { name: 'Обновить предпросмотр последствий', exact: true });
    await activate(preview);
    await confirmCritical(page, codes[0]!, review);
    await review.getByLabel('Причина действия').fill('E2E rollback conflict readback');
    await armFetchFault(page, {
        path: `/api/v1/admin/review-workspace/rollback/${rollbackId}/apply-rollback`,
        method: 'POST',
        status: 409,
    });
    await activate(review.getByRole('button', { name: 'Компенсировать только готовые элементы', exact: true }));
    await expect(review.getByRole('alert')).toContainText('изменились и обновлены');
    await expect(review.getByText(/Предпросмотр подготовлен/u)).toHaveCount(0);
    await expect(preview).toBeEnabled();
    await expect(review.getByRole('button', { name: 'Компенсировать только готовые элементы', exact: true })).toBeDisabled();
});

test('account-deletion replays the exact frozen decision after a lost committed response', async ({ page }) => {
    const codes = await enrollAdmin(page);
    await spaNavigate(page, `/admin/legal-requests/${deletionId}`);
    const review = page
        .getByRole('heading', { name: 'Решение по удалению аккаунта', exact: true })
        .locator('xpath=ancestor::section[1]');
    await confirmCritical(page, codes[0]!, review);
    await review.getByLabel('Основание решения').fill('E2E неизвестный исход решения по удалению');
    const confirmation = review.getByRole('checkbox', { name: 'Подтверждаю решение и его основание' });
    await confirmation.focus();
    await confirmation.press('Space');
    await armFetchFault(page, {
        path: `/api/v1/admin/account-deletions/${deletionId}/review`,
        method: 'POST',
        status: 503,
        commitBeforeFailure: true,
    });
    const submit = review.getByRole('button', { name: 'Подтвердить проверку', exact: true });
    await activate(submit);
    await expect(review.getByRole('alert')).toContainText('Повторите решение без изменений');
    await expect(confirmation).not.toBeChecked();
    await expect(review.getByLabel('Основание решения')).toHaveValue('E2E неизвестный исход решения по удалению');

    await review.getByLabel('Основание решения').fill('E2E изменённое решение по удалению');
    await confirmation.focus();
    await confirmation.press('Space');
    const retry = review.getByRole('button', { name: 'Повторить решение без изменений', exact: true });
    await activate(retry);
    await expect(review.getByRole('alert')).toContainText('Сначала повторите его без изменений');

    await review.getByLabel('Основание решения').fill('E2E неизвестный исход решения по удалению');
    await confirmation.focus();
    await confirmation.press('Space');
    await activate(retry);
    await expect(review.getByRole('status').filter({ hasText: 'Проверка подтверждена' })).toBeVisible();
    await expect(review.getByRole('alert')).toHaveCount(0);
});
