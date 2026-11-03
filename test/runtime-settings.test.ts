import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
    mapRuntimeSettingsRegistry,
    runtimeSettingsRegistryEnvelopeSchema,
} from '../src/features/runtime-settings/runtime-settings-contract.js';

const entry = {
    key: 'web-push-policy',
    label: 'Web Push',
    description: 'Политика доставки.',
    value: 'configured',
    status: 'active' as const,
    source: 'vps_secret' as const,
    readiness: 'ready' as const,
    editable: true,
    sensitive: true,
    updatedAt: '2026-11-02T12:00:00.000Z',
    version: 2,
    blockers: [],
    affectedServices: ['backend', 'push-worker'],
    checks: ['VAPID configured'],
    instruction: null,
    history: [{ at: '2026-11-02T12:00:00.000Z', actor: 'Администратор', summary: 'Политика обновлена' }],
    secret: { configured: true, fingerprint: 'sha256:abcd', rotatedAt: '2026-11-02T10:00:00.000Z' },
    policy: {
        quietHours: { start: '22:00', end: '08:00' },
        ttlSeconds: { critical: 300, important: 14400, informational: 86400, marketing: 21600 },
        version: 2,
    },
};

void test('runtime settings contract is strict and never accepts a secret value', () => {
    const envelope = {
        data: {
            tabs: [{ code: 'notifications' as const, label: 'Уведомления' }],
            selectedTab: 'notifications' as const,
            entries: [entry],
            generatedAt: '2026-11-02T12:00:00.000Z',
            completeness: 'complete' as const,
            unavailableSources: [],
        },
        meta: { requestId: crypto.randomUUID() },
    };
    assert.equal(runtimeSettingsRegistryEnvelopeSchema.safeParse(envelope).success, true);
    assert.equal(
        runtimeSettingsRegistryEnvelopeSchema.safeParse({
            ...envelope,
            data: { ...envelope.data, entries: [{ ...entry, secret: { ...entry.secret, value: 'private-key' } }] },
        }).success,
        false,
    );
    const model = mapRuntimeSettingsRegistry(envelope.data);
    assert.equal(model.items[0]?.displayValue, 'configured');
    assert.equal(model.items[0]?.source, 'VPS secret');
    assert.equal(model.items[0]?.readiness, 'ready');
    assert.deepEqual(model.items[0]?.editablePolicy?.ttlSeconds, entry.policy.ttlSeconds);
});

void test('runtime settings accepts the recovery tab and keeps recovery password value server-side', () => {
    const recovery = {
        data: {
            tabs: [{ code: 'backup_recovery' as const, label: 'Recovery-доступ' }],
            selectedTab: 'backup_recovery' as const,
            entries: [
                {
                    ...entry,
                    key: 'local-backup-recovery-access',
                    label: 'Recovery-доступ к локальному backup',
                    value: 'ключ настроен на VPS · независимая копия не подтверждена',
                    status: 'partial' as const,
                    readiness: 'owner_input' as const,
                    instruction: 'Получите password через root SSH и сохраните в encrypted secure note.',
                    policy: null,
                    editable: false,
                    secret: { configured: true, fingerprint: null, rotatedAt: null },
                },
            ],
            generatedAt: '2026-11-03T01:00:00.000Z',
            completeness: 'complete' as const,
            unavailableSources: [],
        },
        meta: { requestId: crypto.randomUUID() },
    };
    assert.equal(runtimeSettingsRegistryEnvelopeSchema.safeParse(recovery).success, true);
    const model = mapRuntimeSettingsRegistry(recovery.data);
    assert.equal(model.items[0]?.section, 'backup_recovery');
    assert.equal(model.items[0]?.secret?.configured, true);
    assert.equal(model.items[0]?.secret?.fingerprint, null);
    assert.doesNotMatch(JSON.stringify(recovery), /actual-secret|recoveryPasswordValue/);
});

void test('configuration page keeps preview, critical confirmation and responsive labelled rows', async () => {
    const source = await readFile('src/features/runtime-settings/runtime-settings-page.tsx', 'utf8');
    const styles = await readFile('src/features/runtime-settings/runtime-settings.module.css', 'utf8');
    assert.match(source, /Предпросмотр изменений/);
    assert.match(source, /<CriticalConfirmation/);
    assert.match(source, /Значение никогда не передаётся в admin UI/);
    assert.match(source, /Как сохранить безопасно/);
    assert.match(source, /data-label="Источник"/);
    assert.match(source, /data-label="Состояние \/ готовность"/);
    assert.match(source, /Проверяем актуальность снимка/);
    assert.match(styles, /@media \(width <= 48rem\)/);
    assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b/i);
});
