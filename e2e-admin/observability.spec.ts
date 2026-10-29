import { expect, test } from '@playwright/test';
import { enrollAdmin, spaNavigate } from './helpers/admin-session.js';

const headings = ['Система работает штатно', 'Хост и диски', 'Сервисы', 'База данных', 'Очередь', 'Воркеры', 'Провайдеры'];
const themes = ['coffee-light', 'coffee-dark', 'nature-light', 'nature-dark'] as const;

test('renders the strict read-only observability snapshot in every theme', async ({ page }) => {
    const methods: string[] = [];
    page.on('request', (request) => {
        if (request.url().includes('/api/v1/admin/observability')) methods.push(request.method());
    });
    await enrollAdmin(page);
    await spaNavigate(page, '/admin/observability');
    await expect(page.getByRole('heading', { name: 'Наблюдаемость', exact: true })).toBeVisible();
    for (const heading of headings) await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(23);
    await expect(page.getByRole('button', { name: 'Обновить снимок' })).toBeVisible();
    await expect(page.getByRole('button', { name: /перезапустить|повторить задачу|отменить/u })).toHaveCount(0);
    const switcher = page.getByLabel('Тема интерфейса').first();
    for (const theme of themes) {
        await switcher.selectOption(theme, { force: true });
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    }
    await page.getByRole('button', { name: 'Обновить снимок' }).click();
    await expect(page.getByRole('button', { name: 'Обновить снимок' })).toBeEnabled();
    expect(methods.length).toBeGreaterThanOrEqual(2);
    expect(methods.every((method) => method === 'GET')).toBe(true);
});

test('observability remains usable on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enrollAdmin(page);
    await spaNavigate(page, '/admin/observability');
    await expect(page.getByRole('heading', { name: 'Провайдеры', exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
});
