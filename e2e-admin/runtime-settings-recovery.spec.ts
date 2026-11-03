import { expect, test } from '@playwright/test';
import { enrollAdmin, spaNavigate } from './helpers/admin-session.js';

test('shows backup recovery guidance without exposing the password', async ({ page }) => {
    await enrollAdmin(page);
    await spaNavigate(page, '/admin/runtime-settings');

    await page.getByRole('button', { name: 'Recovery-доступ', exact: true }).click();
    await page.getByText('Recovery-доступ к локальному backup', { exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Recovery-доступ к локальному backup' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Как сохранить безопасно' })).toBeVisible();
    await expect(page.getByText('/etc/meal-planner/secrets/local-backup-password')).toBeVisible();
    await expect(page.getByText('/var/backups/meal-planner/local-restic')).toBeVisible();
    await expect(page.getByText('offline_recovery_copy_unconfirmed')).toBeVisible();
    await expect(page.getByRole('button', { name: /показать|скопировать/u })).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/password\s*[:=]\s*\S+/iu);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
});
