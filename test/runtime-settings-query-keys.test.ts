import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { runtimeSettingsKeys } from '../src/features/runtime-settings/query-keys.js';

void test('runtime settings feature preserves exact root and principal-scoped registry tuples', () => {
    assert.deepEqual(runtimeSettingsKeys.root, ['runtime-settings']);
    assert.deepEqual(runtimeSettingsKeys.registry('principal-1', 'mail'), ['runtime-settings', 'principal-1', 'mail']);
    assert.deepEqual(runtimeSettingsKeys.registry(undefined, 'backup_recovery'), [
        'runtime-settings',
        undefined,
        'backup_recovery',
    ]);
    assert.notDeepEqual(
        runtimeSettingsKeys.registry('principal-1', 'mail'),
        runtimeSettingsKeys.registry('principal-2', 'mail'),
    );
});

void test('runtime settings API preserves query gating, fetch and broad successful invalidation semantics', async () => {
    const source = await readFile(resolve('src/features/runtime-settings/runtime-settings-api.ts'), 'utf8');

    assert.match(source, /runtimeSettingsKeys\.registry\(session\.data\?\.id, section\)/u);
    assert.match(source, /enabled:\s*!!api && !!session\.data/u);
    assert.match(source, /query:\s*\{ tab: section \}/u);
    assert.match(
        source,
        /onSuccess:\s*async \(\) => cache\.invalidateQueries\(\{ queryKey: runtimeSettingsKeys\.root \}\)/u,
    );
    assert.doesNotMatch(source, /queryKey:\s*\['runtime-settings'/u);
});
