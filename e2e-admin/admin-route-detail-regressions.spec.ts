import { expect, test } from '@playwright/test';
import { confirmCritical, enrollAdmin, spaNavigate } from './helpers/admin-session.js';
import { stableUuid } from '../src/features/releases/api.js';

const firstAchievementId = stableUuid('achievement-first-dish');
const missingAchievementId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const moderationId = '10000000-0000-4000-8000-000000000001';

test('keeps an achievement deep link bound to its requested identity', async ({ page }) => {
    await enrollAdmin(page);

    await spaNavigate(page, `/admin/catalog/achievements/${firstAchievementId}`);
    await expect(page.getByRole('heading', { name: 'Первое блюдо', exact: true })).toBeVisible();

    await spaNavigate(page, `/admin/catalog/achievements/${missingAchievementId}`);
    await expect(page.getByRole('alert')).toHaveText('Достижение с таким идентификатором не найдено.');
    await page.getByRole('link', { name: 'К списку достижений', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/catalog\/achievements$/u);
    await expect(page).toHaveTitle('Достижения · Meal Planner Admin');
    await expect(page.getByRole('heading', { name: 'Первое блюдо', exact: true })).toBeVisible();
});

test('uses canonical metadata for dedicated catalog routes', async ({ page }) => {
    await enrollAdmin(page);
    for (const [path, title] of [
        ['/admin/catalog/allergens', 'Словарь аллергенов · Meal Planner Admin'],
        ['/admin/catalog/achievements', 'Достижения · Meal Planner Admin'],
        ['/admin/catalog/reputation', 'Репутация · Meal Planner Admin'],
    ] as const) {
        await spaNavigate(page, path);
        await expect(page).toHaveTitle(title);
        await expect(page.locator('#main')).toBeFocused();
    }
});

test('rejects and reads back a pending revision through the canonical moderation route', async ({ page }) => {
    test.setTimeout(90_000);
    const recoveryCodes = await enrollAdmin(page);
    await spaNavigate(page, `/admin/moderation/${moderationId}`);

    const workspace = page
        .getByRole('heading', { name: 'Проверка версии материала', exact: true })
        .locator('xpath=ancestor::section[1]');
    await expect(workspace.getByRole('heading', { name: 'Редакция текущей проверки', exact: true })).toBeVisible();
    await confirmCritical(page, recoveryCodes[0]!, workspace);
    await workspace.getByLabel('Внутренний комментарий').fill('E2E: служебная проверка состава');
    await workspace.getByLabel('Причина для автора').fill('E2E: версия не соответствует правилам публикации');
    await workspace.getByRole('button', { name: 'Отклонить с причиной', exact: true }).click();
    await expect(workspace.getByRole('status').filter({ hasText: 'Решение сохранено.' })).toBeVisible();
    await expect(workspace.getByText('Причина для автора: E2E: версия не соответствует правилам публикации', { exact: true })).toBeVisible();
    await expect(workspace.getByText('Внутренняя история решений (1)', { exact: true })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/admin/moderation/${moderationId}$`, 'u'));
    await expect(page.getByText('Причина для автора: E2E: версия не соответствует правилам публикации', { exact: true })).toBeVisible();
    await expect(page.getByText('Внутренняя история решений (1)', { exact: true })).toBeVisible();
});
