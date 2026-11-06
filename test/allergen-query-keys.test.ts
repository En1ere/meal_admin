import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { allergenKeys } from '../src/features/allergens/query-keys.js';

void test('allergen feature preserves exact session-global list, detail and subject tuples', () => {
    assert.deepEqual(allergenKeys.root, ['admin', 'allergens']);
    assert.deepEqual(allergenKeys.list(), ['admin', 'allergens']);
    assert.deepEqual(allergenKeys.detail('milk'), ['admin', 'allergens', 'detail', 'milk']);
    assert.deepEqual(allergenKeys.detail(undefined), ['admin', 'allergens', 'detail', undefined]);
    assert.deepEqual(allergenKeys.subjects('variant', 'сыр'), ['admin', 'allergen-subjects', 'variant', 'сыр']);
});

void test('allergen page uses exact feature-local keys without changing query and mutation semantics', async () => {
    const source = await readFile(resolve('src/features/allergens/allergens-page.tsx'), 'utf8');

    assert.equal([...source.matchAll(/queryKey:\s*allergenKeys\.list\(\)/gu)].length, 1);
    assert.equal([...source.matchAll(/queryKey:\s*allergenKeys\.detail\(selectedCode\)/gu)].length, 1);
    assert.equal([...source.matchAll(/queryKey:\s*allergenKeys\.subjects\(subjectType, subjectQuery\)/gu)].length, 1);
    assert.equal([...source.matchAll(/setQueryData\(allergenKeys\.detail\(detail\.data\.code\), next\)/gu)].length, 1);
    assert.equal(
        [...source.matchAll(/invalidateQueries\(\{ queryKey: allergenKeys\.root, exact: false \}\)/gu)].length,
        1,
    );
    assert.match(source, /enabled:\s*!!api/u);
    assert.match(source, /enabled:\s*!!api && !!selectedCode/u);
    assert.doesNotMatch(source, /queryKey:\s*\['admin',\s*'allergen/u);
    assert.doesNotMatch(source, /setQueryData\(\['admin',\s*'allergens'/u);
});
