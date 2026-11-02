import type { AdminState } from './admin-model.js';

const tabs = [
    ['notifications', 'Уведомления'],
    ['mail', 'Почта'],
    ['storage', 'Хранилище и OCR'],
    ['security', 'Безопасность'],
    ['deploy_backup', 'Деплой и backup'],
    ['integrations', 'Интеграции'],
    ['legal', 'Юридические данные'],
] as const;
const labels: Record<string, string> = {
    mail: 'SMTP',
    storage: 'Media storage и OCR',
    security: 'Ключи и доступ',
    deploy_backup: 'Deployment и backup',
    integrations: 'AI и оплаты',
    legal: 'Юридические данные',
};

function policy(state: AdminState) {
    const rows = (state.tables.__runtime_settings_policy ??= []);
    const current = rows[0] ?? {
        id: 'web-push-policy',
        start: '22:00',
        end: '08:00',
        critical: 300,
        important: 14400,
        informational: 86400,
        marketing: 21600,
        version: 1,
        updated_at: null,
    };
    if (!rows[0]) rows.push(current);
    return current;
}
const history = (updatedAt: string | null) =>
    updatedAt ? [{ at: updatedAt, actor: 'Тестовый администратор', summary: 'Web Push policy обновлена' }] : [];

export function runtimeSettingsMock(
    state: AdminState,
    input: { method: string; path: string; tab: string | null; body: unknown; critical: boolean; now: number },
) {
    if (!input.path.startsWith('/api/v1/admin/runtime-settings')) return null;
    const current = policy(state);
    const version = Number(current.version);
    const webPolicy = {
        quietHours: { start: String(current.start), end: String(current.end) },
        ttlSeconds: {
            critical: Number(current.critical),
            important: Number(current.important),
            informational: Number(current.informational),
            marketing: Number(current.marketing),
        },
        version,
    };
    if (input.method === 'GET') {
        const tab = tabs.some(([code]) => code === input.tab) ? input.tab! : 'notifications';
        const entries =
            tab === 'notifications'
                ? [
                      {
                          key: 'web-push-policy',
                          label: 'Web Push policy',
                          description: 'Тихие часы и срок жизни push-сообщений.',
                          value: 'configured',
                          status: 'active',
                          source: 'database',
                          readiness: 'ready',
                          editable: true,
                          sensitive: false,
                          updatedAt: current.updated_at ? String(current.updated_at) : null,
                          version,
                          blockers: [],
                          affectedServices: ['backend', 'push-worker', 'frontend'],
                          checks: ['VAPID configured', 'worker health'],
                          instruction: null,
                          history: history(current.updated_at ? String(current.updated_at) : null),
                          secret: null,
                          policy: webPolicy,
                      },
                  ]
                : [
                      {
                          key: `${tab}-readiness`,
                          label: labels[tab] ?? tab,
                          description: 'Безопасная агрегированная готовность раздела.',
                          value: 'missing',
                          status: 'blocked',
                          source: 'derived',
                          readiness: 'owner_input',
                          editable: false,
                          sensitive: true,
                          updatedAt: null,
                          version: null,
                          blockers: ['Требуются данные владельца'],
                          affectedServices: ['backend'],
                          checks: [],
                          instruction: 'Следуйте production runbook соответствующего сервиса.',
                          history: [],
                          secret: { configured: false, fingerprint: null, rotatedAt: null },
                          policy: null,
                      },
                  ];
        return {
            kind: 'success' as const,
            data: {
                generatedAt: new Date(input.now).toISOString(),
                completeness: 'complete',
                unavailableSources: [],
                tabs: tabs.map(([code, label]) => ({ code, label })),
                selectedTab: tab,
                entries,
            },
        };
    }
    const body = input.body as Record<string, unknown>;
    if (input.path.endsWith('/preview'))
        return {
            kind: 'success' as const,
            data: {
                previewId: crypto.randomUUID(),
                expiresAt: new Date(input.now + 300000).toISOString(),
                changes: [{ field: 'policy', from: JSON.stringify(webPolicy), to: JSON.stringify(body) }],
                policy: webPolicy,
            },
        };
    if (input.path.endsWith('/execute')) {
        if (!input.critical) return { kind: 'error' as const, status: 403, code: 'ADMIN_CONFIRMATION_REQUIRED' };
        if (Number(body.expectedVersion) !== version) return { kind: 'error' as const, status: 412 };
        const quiet = body.quietHours as Record<string, unknown>;
        const ttl = body.ttlSeconds as Record<string, unknown>;
        Object.assign(current, {
            start: quiet.start,
            end: quiet.end,
            critical: ttl.critical,
            important: ttl.important,
            informational: ttl.informational,
            marketing: ttl.marketing,
            version: version + 1,
            updated_at: new Date(input.now).toISOString(),
        });
        return {
            kind: 'success' as const,
            data: {
                policy: {
                    quietHours: { start: String(current.start), end: String(current.end) },
                    ttlSeconds: {
                        critical: Number(current.critical),
                        important: Number(current.important),
                        informational: Number(current.informational),
                        marketing: Number(current.marketing),
                    },
                    version: version + 1,
                },
                updatedAt: String(current.updated_at),
            },
        };
    }
    return { kind: 'error' as const, status: 404 };
}
