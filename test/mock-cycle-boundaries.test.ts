import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { allergensHandle, createAllergensState } from '../src/mocks/allergens.js';
import { adminRowSchema as compatibilityAdminRowSchema } from '../src/mocks/admin-model.js';
import { adminRowSchema } from '../src/mocks/admin-row.js';
import { relatedFixtures } from '../src/mocks/admin-related-fixtures.js';

void test('admin row compatibility export delegates to the neutral mock model and validates every related fixture', () => {
    assert.strictEqual(compatibilityAdminRowSchema, adminRowSchema);
    for (const rows of Object.values(relatedFixtures())) {
        for (const row of rows) assert.deepEqual(adminRowSchema.parse(row), row);
    }
});

void test('allergen handler accepts its narrow state and preserves list behavior', async () => {
    const state = { allergens: createAllergensState() };
    const response = allergensHandle({
        state,
        path: '/api/v1/admin/allergens',
        params: {},
        method: 'GET',
        query: new URLSearchParams({ q: 'молоко', limit: '10', offset: '0' }),
        input: undefined,
        success: (data) => Response.json(data),
        fail: (status) => new Response(null, { status }),
    });
    assert.ok(response);
    assert.equal(response.status, 200);
    const payload = (await response.json()) as { items: Array<{ code: string }>; total: number };
    assert.equal(payload.total, 1);
    assert.deepEqual(
        payload.items.map((item) => item.code),
        ['milk'],
    );
    assert.strictEqual(state.allergens.items[0]?.code, 'milk');
});

void test('mock dependencies stay directed through neutral row and narrow allergen state boundaries', async () => {
    const [adminModel, fixtures, allergens, model] = await Promise.all([
        readFile(resolve('src/mocks/admin-model.ts'), 'utf8'),
        readFile(resolve('src/mocks/admin-related-fixtures.ts'), 'utf8'),
        readFile(resolve('src/mocks/allergens.ts'), 'utf8'),
        readFile(resolve('src/mocks/model.ts'), 'utf8'),
    ]);
    assert.match(adminModel, /from '.\/admin-related-fixtures\.js'/u);
    assert.match(fixtures, /from '.\/admin-row\.js'/u);
    assert.doesNotMatch(fixtures, /from '.\/admin-model\.js'/u);
    assert.match(model, /from '.\/allergens\.js'/u);
    assert.doesNotMatch(allergens, /from '.\/model\.js'/u);
    assert.match(allergens, /interface AllergenMockState\s*\{\s*allergens: AllergensState;/u);
});
