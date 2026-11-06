import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { adminNotificationKeys } from '../src/entities/admin-notification/index.js';
import { adminNotificationCenterKeys } from '../src/entities/admin-notification/center-query-keys.js';
import { adminNotificationPreferencesKeys } from '../src/entities/admin-notification/preferences-query-keys.js';

void test('admin notification entity preserves principal-scoped cache tuples', () => {
    assert.deepEqual(adminNotificationKeys.preferencesRoot, ['notification-settings']);
    assert.deepEqual(adminNotificationKeys.preferences('principal-1'), ['notification-settings', 'principal-1']);
    assert.deepEqual(adminNotificationKeys.preferences(undefined), ['notification-settings', undefined]);
    assert.deepEqual(adminNotificationKeys.centerRoot, ['notification-center']);
    assert.deepEqual(adminNotificationKeys.center('principal-1'), ['notification-center', 'principal-1']);
    assert.deepEqual(adminNotificationKeys.center(undefined), ['notification-center', undefined]);
    assert.notDeepEqual(adminNotificationKeys.center('principal-1'), adminNotificationKeys.center('principal-2'));
    assert.deepEqual(adminNotificationPreferencesKeys.root, adminNotificationKeys.preferencesRoot);
    assert.deepEqual(
        adminNotificationPreferencesKeys.forPrincipal('principal-1'),
        adminNotificationKeys.preferences('principal-1'),
    );
    assert.deepEqual(adminNotificationCenterKeys.root, adminNotificationKeys.centerRoot);
    assert.deepEqual(
        adminNotificationCenterKeys.forPrincipal('principal-1'),
        adminNotificationKeys.center('principal-1'),
    );
});

void test('notification consumers use the entity factory with the current principal', async () => {
    const [settings, center] = await Promise.all([
        readFile(resolve('src/features/notifications/notification-settings.tsx'), 'utf8'),
        readFile(resolve('src/features/notifications/notification-center.tsx'), 'utf8'),
    ]);
    assert.match(settings, /adminNotificationPreferencesKeys\.forPrincipal\(session\.data\?\.id\)/u);
    assert.match(center, /adminNotificationCenterKeys\.forPrincipal\(session\.data\?\.id\)/u);
    assert.doesNotMatch(settings, /\['notification-settings',\s*session\.data\?\.id\]/u);
    assert.doesNotMatch(center, /\['notification-center',\s*session\.data\?\.id\]/u);
    assert.match(settings, /enabled:\s*!!api\s*&&\s*session\.data\?\.context\s*===\s*'admin'/u);
    assert.match(center, /enabled:\s*!!api\s*&&\s*session\.data\?\.context\s*===\s*'admin'/u);
});

void test('notification consumers use specialized entity contract entrypoints without compatibility barrels', async () => {
    const [settings, center, centerTest, entityIndex] = await Promise.all([
        readFile(resolve('src/features/notifications/notification-settings.tsx'), 'utf8'),
        readFile(resolve('src/features/notifications/notification-center.tsx'), 'utf8'),
        readFile(resolve('test/notification-center.test.ts'), 'utf8'),
        readFile(resolve('src/entities/admin-notification/index.ts'), 'utf8'),
    ]);
    assert.match(settings, /entities\/admin-notification\/preferences\.js/u);
    assert.match(center, /entities\/admin-notification\/center-contracts\.js/u);
    assert.match(centerTest, /entities\/admin-notification\/center-contracts\.js/u);
    assert.doesNotMatch(entityIndex, /export\s+\*/u);
    await assert.rejects(access(resolve('src/features/notifications/preferences.ts')));
    await assert.rejects(access(resolve('src/features/notifications/center-contracts.ts')));
});
