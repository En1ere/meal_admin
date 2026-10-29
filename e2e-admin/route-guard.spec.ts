import { expect, test } from '@playwright/test';

test('protects private deep links while auth and not-found routes stay public', async ({ page }) => {
    await page.goto('/admin/releases/11111111-1111-4111-8111-111111111111');
    await expect(page).toHaveURL(/\/auth\?returnTo=%2Fadmin%2Freleases%2F11111111-1111-4111-8111-111111111111$/u);
    await expect(page.getByRole('heading', { name: 'Вход администратора' })).toBeVisible();

    await page.goto('/settings/recipes');
    await expect(page).toHaveURL(/\/auth\?returnTo=%2Fsettings%2Frecipes$/u);

    await page.goto('/auth');
    await expect(page).toHaveURL(/\/auth$/u);
    await expect(page.getByRole('heading', { name: 'Вход администратора' })).toBeVisible();

    await page.goto('/does-not-exist');
    await expect(page).toHaveURL(/\/does-not-exist$/u);
    await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
});
