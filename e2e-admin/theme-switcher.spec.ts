import { expect, test } from '@playwright/test';
import { enrollAdmin, spaNavigate } from './helpers/admin-session.js';

const themes = ['coffee-light', 'coffee-dark', 'nature-light', 'nature-dark'] as const;
const moderationId = '10000000-0000-4000-8000-000000000001';

test('offers and persists every design-system theme before sign-in', async ({ page }) => {
    await page.goto('/auth');
    const switcher = page.getByLabel('Тема интерфейса').filter({ visible: true }).first();
    await expect(switcher.locator('option')).toHaveCount(themes.length);
    for (const theme of themes) {
        await switcher.selectOption(theme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect
            .poll(() => page.evaluate(() => localStorage.getItem('meal-admin-theme')))
            .toBe(theme);
    }
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'nature-dark');
    await expect(page.getByLabel('Тема интерфейса')).toHaveValue('nature-dark');
});

test('keeps the theme switcher available in the authenticated admin shell', async ({ page }) => {
    await enrollAdmin(page);
    await spaNavigate(page, '/admin/overview');
    const switcher = page.getByLabel('Тема интерфейса');
    await expect(switcher).toBeVisible();
    await switcher.selectOption('coffee-dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'coffee-dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'coffee-dark');
});

test('revision moderation remains usable in every theme and keyboard order', async ({ page }) => {
    await enrollAdmin(page);
    await spaNavigate(page, `/admin/moderation/${moderationId}`);
    const workspace = page
        .getByRole('heading', { name: 'Проверка версии материала', exact: true })
        .locator('xpath=ancestor::section[1]');
    const switcher = page.getByLabel('Тема интерфейса').first();
    for (const theme of themes) {
        await switcher.selectOption(theme, { force: true });
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(workspace.getByRole('heading', { name: 'Активная публичная редакция' })).toBeVisible();
        await expect(workspace.getByRole('heading', { name: 'Редакция текущей проверки' })).toBeVisible();
    }
    const internal = workspace.getByLabel('Внутренний комментарий');
    const authorFacing = workspace.getByLabel('Причина для автора');
    await internal.focus();
    await expect(internal).toBeFocused();
    await internal.press('Tab');
    await expect(authorFacing).toBeFocused();
});
