import { expect, test } from '@playwright/test';
import { armFetchFault, installFetchFaultHarness } from './helpers/fetch-fault.js';
import { activate, confirmCritical, enrollAdmin, spaNavigate } from './helpers/admin-session.js';

const userId = '10000000-0000-4000-8000-000000000007';

test.beforeEach(async ({ context }) => installFetchFaultHarness(context));

test('billing preserves an unknown command for exact retry and resets preview after conflict', async ({ page }) => {
    test.setTimeout(90_000);
    const codes = await enrollAdmin(page);
    await spaNavigate(page, `/admin/users/${userId}`);
    const billing = page
        .getByRole('heading', { name: 'Подписки и возвраты', exact: true })
        .locator('xpath=ancestor::section[1]');
    await confirmCritical(page, codes[0]!, billing);

    await billing.getByLabel('Тариф').selectOption('plus');
    await billing.getByLabel('Новая дата окончания (местное время)').fill('2030-01-01T12:00');
    const reason = billing.getByLabel('Причина');
    await reason.fill('E2E billing exact retry');
    await activate(billing.getByRole('button', { name: 'Проверить последствия', exact: true }));
    const confirmation = billing.getByRole('checkbox', { name: 'Подтверждаю операцию', exact: true });
    await confirmation.focus();
    await confirmation.press('Space');
    await armFetchFault(page, {
        path: `/api/v1/admin/billing/users/${userId}`,
        method: 'POST',
        status: 503,
        commitBeforeFailure: true,
    });
    await activate(billing.getByRole('button', { name: 'Выполнить', exact: true }));
    await expect(billing.getByRole('status').filter({ hasText: 'Исход финансовой операции неизвестен' })).toBeVisible();

    await reason.fill('Изменённый billing intent');
    await activate(billing.getByRole('button', { name: 'Проверить последствия', exact: true }));
    await confirmation.focus();
    await confirmation.press('Space');
    await activate(billing.getByRole('button', { name: 'Выполнить', exact: true }));
    await expect(billing.getByRole('status').filter({ hasText: 'Повторите прежнюю операцию' })).toBeVisible();

    await reason.fill('E2E billing exact retry');
    await activate(billing.getByRole('button', { name: 'Проверить последствия', exact: true }));
    await confirmation.focus();
    await confirmation.press('Space');
    await activate(billing.getByRole('button', { name: 'Выполнить', exact: true }));
    await expect(billing.getByRole('status').filter({ hasText: 'Тестовая операция сохранена' })).toBeVisible();
    await expect(billing).toContainText('Тариф: plus');

    await billing.getByLabel('Действие').selectOption('freeze');
    await reason.fill('E2E billing conflict refresh');
    await activate(billing.getByRole('button', { name: 'Проверить последствия', exact: true }));
    await confirmation.focus();
    await confirmation.press('Space');
    await armFetchFault(page, {
        path: `/api/v1/admin/billing/users/${userId}`,
        method: 'POST',
        status: 409,
    });
    await activate(billing.getByRole('button', { name: 'Выполнить', exact: true }));
    await expect(billing.getByRole('status').filter({ hasText: 'изменились и обновлены' })).toBeVisible();
    await expect(billing.getByRole('region', { name: 'Последствия финансовой операции' })).toHaveCount(0);
    await expect(billing.getByRole('button', { name: 'Проверить последствия', exact: true })).toBeEnabled();
});

test('refund preview respects the monetary contract and stays fail-closed', async ({ page }) => {
    await enrollAdmin(page);
    await spaNavigate(page, '/admin/payments/71000000-0000-4000-8000-000000000001');
    const billing = page
        .getByRole('heading', { name: 'Подписки и возвраты', exact: true })
        .locator('xpath=ancestor::section[1]');
    const amount = billing.getByLabel('Сумма в копейках');
    await expect(amount).toHaveAttribute('maxlength', '16');
    await amount.fill('29900');
    await billing.getByLabel('Причина').fill('E2E безопасный preview возврата');
    await billing.getByRole('button', { name: 'Проверить последствия', exact: true }).click();
    await expect(billing.getByRole('region', { name: 'Последствия финансовой операции' })).toContainText('299,00 ₽');
    await expect(billing.getByRole('button', { name: 'Выполнить', exact: true })).toBeDisabled();
    await expect(billing.getByRole('note')).toContainText('выполнить его нельзя');
});
