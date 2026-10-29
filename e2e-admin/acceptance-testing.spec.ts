import { expect, test } from '@playwright/test';
import { enrollAdmin, spaNavigate } from './helpers/admin-session.js';

const themes = ['coffee-light', 'coffee-dark', 'nature-light', 'nature-dark'] as const;

test('records, reloads and resets an acceptance result', async ({ page }) => {
    const methods: string[] = [];
    page.on('request', (request) => {
        if (request.url().includes('/api/v1/admin/acceptance-tests')) methods.push(request.method());
    });
    await enrollAdmin(page);
    await spaNavigate(page, '/admin/testing');
    await expect(page.getByRole('heading', { name: 'Приёмочное тестирование', exact: true })).toBeVisible();
    await expect(page.getByText('0 из 4 проверено')).toBeVisible();
    await page.getByRole('radio', { name: /Частично/u }).check();
    await page.getByLabel('Комментарий').fill('Основной сценарий работает, backup проверим отдельно.');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByText('1 из 4 проверено')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('radio', { name: /Частично/u })).toBeChecked();
    await expect(page.getByLabel('Комментарий')).toHaveValue(
        'Основной сценарий работает, backup проверим отдельно.',
    );
    await page.getByRole('button', { name: 'Вернуть на проверку', exact: true }).click();
    await expect(page.getByText('0 из 4 проверено')).toBeVisible();
    expect(methods).toContain('PUT');
    expect(methods).toContain('POST');
});

test('supports filters, all themes and a narrow viewport without page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enrollAdmin(page);
    await spaNavigate(page, '/admin/testing');
    await page.getByPlaceholder('Поиск по кейсам…').fill('MFA');
    await expect(page.getByRole('button', { name: /API-01/u })).toBeVisible();
    const switcher = page.getByLabel('Тема интерфейса').first();
    for (const theme of themes) {
        await switcher.selectOption(theme, { force: true });
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
});

