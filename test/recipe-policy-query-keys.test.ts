import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { recipePolicyKeys } from '../src/features/settings/recipe-policy-query-keys.js';

void test('recipe policy feature preserves the exact principal-scoped cache tuple', () => {
    assert.deepEqual(recipePolicyKeys.forPrincipal('principal-1'), ['recipe-policy', 'principal-1']);
    assert.deepEqual(recipePolicyKeys.forPrincipal(undefined), ['recipe-policy', undefined]);
    assert.notDeepEqual(recipePolicyKeys.forPrincipal('principal-1'), recipePolicyKeys.forPrincipal('principal-2'));
});

void test('recipe policy consumer preserves principal source, gating, save and explicit refetch semantics', async () => {
    const source = await readFile(resolve('src/features/settings/recipe-policy.tsx'), 'utf8');

    assert.match(source, /recipePolicyKeys\.forPrincipal\(session\.data\?\.id\)/u);
    assert.match(source, /enabled:\s*!!api && !!session\.data/u);
    assert.match(source, /await api\.request\(\s*'PUT \/api\/v1\/admin\/settings\/recipe-policy'/u);
    assert.match(source, /await refresh\(\)/u);
    assert.match(source, /refresh=\{\(\) => query\.refetch\(\)\}/u);
    assert.doesNotMatch(source, /queryKey:\s*\['recipe-policy'/u);
});
