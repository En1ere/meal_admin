import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { contracts } from '../src/shared/api/contracts.generated.js';
import { adminAiKeys } from '../src/entities/admin-ai/index.js';
import { createAdminAiFixture } from '../src/mocks/admin-ai.js';

void test('AI control plane uses generated strict contract and session-scoped query identity', () => {
    const data = createAdminAiFixture(new Date('2026-11-06T17:20:00.000Z'));
    const schema = contracts['GET /api/v1/admin/ai'].success;
    assert.equal(schema.safeParse({ data, meta: { requestId: crypto.randomUUID() } }).success, true);
    assert.equal(
        schema.safeParse({ data: { ...data, token: 'secret' }, meta: { requestId: crypto.randomUUID() } }).success,
        false,
    );
    assert.equal(data.tasks.length, 18);
    assert.equal(data.operations.reconciliationHoldCount, 1);
    assert.notDeepEqual(adminAiKeys.snapshot('session-a'), adminAiKeys.snapshot('session-b'));
});

void test('AI control page is read-only and exposes actionable loading, error and tariff context states', async () => {
    const source = await readFile('src/features/ai-control/ai-control-page.tsx', 'utf8');
    assert.match(source, /GET \/api\/v1\/admin\/ai/);
    assert.doesNotMatch(source, /POST \/api\/v1\/admin\/ai|useMutation/);
    assert.match(source, /AI-контур недоступен/);
    assert.match(source, /requiredContext/);
    assert.match(source, /availableOn/);
    assert.match(source, /Массовый автоматический возврат запрещён/);
    assert.match(source, /operations\.financial/);
    assert.match(source, /refetchOnWindowFocus:\s*false/);
});
