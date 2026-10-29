import assert from 'node:assert/strict';
import test from 'node:test';
import { contracts } from '../src/shared/api/contracts.generated.js';
import {
    adminObservabilityKeys,
    collectObservabilityIssues,
    formatBytes,
    formatDuration,
    freshnessText,
} from '../src/entities/admin-observability/index.js';
import { createObservabilityFixture } from '../src/mocks/observability.js';

void test('observability uses generated strict contract and session-scoped keys', () => {
    const data = createObservabilityFixture(new Date('2026-10-29T10:00:00.000Z'));
    const schema = contracts['GET /api/v1/admin/observability'].success;
    assert.equal(schema.safeParse({ data, meta: { requestId: crypto.randomUUID() } }).success, true);
    assert.equal(
        schema.safeParse({ data: { ...data, unexpected: true }, meta: { requestId: crypto.randomUUID() } }).success,
        false,
    );
    assert.equal(
        schema.safeParse({
            data: { ...data, workers: data.workers.slice(1) },
            meta: { requestId: crypto.randomUUID() },
        }).success,
        false,
    );
    assert.notDeepEqual(adminObservabilityKeys.snapshot('session-a'), adminObservabilityKeys.snapshot('session-b'));
});

void test('presentation preserves zero and null and does not invent health thresholds', () => {
    assert.equal(formatBytes(0), '0 Б');
    assert.equal(formatBytes(null), 'Нет данных');
    assert.equal(formatDuration(0), '0 мс');
    assert.equal(formatDuration(null), 'Нет данных');
    const data = createObservabilityFixture(new Date('2026-10-29T10:00:00.000Z'));
    data.host.containers[0]!.cpuPermille = 999_999;
    data.host.filesystems[0]!.usedPercent = 100;
    assert.deepEqual(collectObservabilityIssues(data), []);
});

void test('issue derivation distinguishes failures from informational states', () => {
    const data = createObservabilityFixture(new Date('2026-10-29T10:00:00.000Z'));
    data.workers[0]!.lastOutcome = 'skipped_overlap';
    data.workers[1]!.freshness = { state: 'no_samples', observedAt: null, ageSeconds: null, staleAfterSeconds: 150 };
    assert.deepEqual(collectObservabilityIssues(data), []);
    assert.equal(freshnessText(data.workers[1]!.freshness), 'Наблюдений пока нет');
    data.queue.dueNow = 2;
    data.queue.counts!.deadLetter = 1;
    data.providers.services[0]!.timeout = 1;
    data.host.containers[0]!.health = 'unhealthy';
    data.database.freshness = { ...data.database.freshness, state: 'stale' };
    data.queue.freshness = { ...data.queue.freshness, state: 'unavailable' };
    data.providers.services[0]!.freshness = { ...data.providers.services[0]!.freshness, state: 'stale' };
    const keys = collectObservabilityIssues(data).map((item) => item.key);
    assert.ok(keys.includes('queue-due'));
    assert.ok(keys.includes('queue-dead'));
    assert.ok(keys.includes('provider-ai'));
    assert.ok(keys.includes('health-postgres'));
    assert.ok(keys.includes('database-stale'));
    assert.ok(keys.includes('queue-unavailable'));
    assert.ok(keys.includes('provider-ai-stale'));
});
