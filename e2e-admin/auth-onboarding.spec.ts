import { expect, test } from '@playwright/test';
import { enterFreshTotp } from './helpers/admin-session.js';

test('first admin login exposes an actionable and theme-aware TOTP enrollment', async ({ context, page }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/auth');
    await expect(page.getByLabel('Тема интерфейса')).toBeVisible();
    await page.getByLabel('Логин').fill('admin');
    await page.getByLabel('Пароль').fill('1');
    await page.getByRole('button', { name: 'Продолжить' }).click();

    await page.waitForURL(/\/auth\/mfa/u);
    await expect(page.getByRole('heading', { name: 'Подключите приложение-аутентификатор' })).toBeVisible();
    const secret = await page.locator('.enrollment code').textContent();
    expect(secret).toBeTruthy();
    const copySecret = page.getByRole('button', { name: 'Скопировать ключ' });
    await copySecret.click();
    await expect(page.getByRole('status').filter({ hasText: 'Скопировано в буфер обмена.' })).toBeVisible();
    await expect(page.getByText('Буфер обмена не очищается автоматически.').first()).toBeVisible();
    await expect(copySecret).toHaveText('Скопировать ключ', { timeout: 6000 });
    await expect(page.getByRole('link', { name: 'Открыть в приложении-аутентификаторе' })).toHaveAttribute(
        'href',
        /^otpauth:\/\/totp\/[^#]+algorithm=SHA1&digits=6&period=30$/u,
    );
    await expect(page.getByLabel('Код подтверждения')).toHaveAttribute('inputmode', 'numeric');
    await page.getByLabel('Тема интерфейса').selectOption('coffee-light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'coffee-light');

    await enterFreshTotp(page.getByLabel('Код подтверждения'), secret!);
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Резервные коды' }).getByRole('listitem')).toHaveCount(10);
    await expect(page.getByRole('button', { name: 'Скопировать коды' })).toBeVisible();
});

for (const [name, uri] of [
    ['wrong secret', 'otpauth://totp/Meal%20Planner%3Aadmin?secret=WRONG&issuer=Meal%20Planner'],
    ['unsupported algorithm', 'otpauth://totp/Meal%20Planner%3Aadmin?secret=SECRET&issuer=Meal%20Planner&algorithm=SHA256'],
    ['unsafe protocol', 'javascript:alert(1)'],
] as const) {
    test(`does not expose an authenticator link for ${name}`, async ({ page }) => {
        // The development API is served by an in-page MSW worker, so Playwright's
        // network routing cannot observe this request. Patch fetch before the app
        // boots and mutate only the test response after MSW has produced it.
        await page.addInitScript((unsafeUri) => {
            const originalFetch = window.fetch.bind(window);
            window.fetch = async (...args) => {
                const response = await originalFetch(...args);
                const request = args[0];
                const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
                if (!url.endsWith('/api/v1/admin/auth/login')) return response;
                const payload = (await response.clone().json()) as {
                    data: { enrollment: { secret: string; uri: string } | null };
                };
                if (!payload.data.enrollment) return response;
                payload.data.enrollment.uri = unsafeUri.replace('SECRET', payload.data.enrollment.secret);
                const headers = new Headers(response.headers);
                headers.delete('content-length');
                return new Response(JSON.stringify(payload), {
                    status: response.status,
                    statusText: response.statusText,
                    headers,
                });
            };
        }, uri);
        await page.goto('/auth');
        await page.getByLabel('Логин').fill('admin');
        await page.getByLabel('Пароль').fill('1');
        await page.getByRole('button', { name: 'Продолжить' }).click();
        await page.waitForURL(/\/auth\/mfa/u);
        await expect(page.getByRole('heading', { name: 'Подключите приложение-аутентификатор' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Открыть в приложении-аутентификаторе' })).toHaveCount(0);
    });
}
