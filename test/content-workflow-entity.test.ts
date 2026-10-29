import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    contentCommandIntent,
    contentForbiddenRecovery,
    contentModerateSchema,
    contentWorkflowKeys,
    type ContentMutatingCommand,
} from '../src/entities/content-workflow/index.js';

const command = (idempotencyKey: string, reason = 'Проверено'): ContentMutatingCommand => ({
    action: 'moderate',
    data: { action: 'reject', version: 7, reason, idempotencyKey },
});

void test('content forbidden recovery distinguishes expired confirmation from role denial', () => {
    const now = Date.parse('2026-10-27T12:00:00.000Z');
    assert.equal(contentForbiddenRecovery(null, now), 'reconfirm');
    assert.equal(contentForbiddenRecovery('2026-10-27T11:59:59.000Z', now), 'reconfirm');
    assert.equal(contentForbiddenRecovery('2026-10-27T12:30:00.000Z', now), 'access-denied');
});

void test('content command intent excludes generated key but binds every operator input', () => {
    const first = contentCommandIntent(command('10000000-0000-4000-8000-000000000001'));
    const replay = contentCommandIntent(command('10000000-0000-4000-8000-000000000002'));
    assert.equal(first, replay);
    assert.notEqual(first, contentCommandIntent(command('10000000-0000-4000-8000-000000000003', 'Другая причина')));
    assert.notEqual(
        first,
        contentCommandIntent({
            action: 'moderate',
            data: {
                action: 'reject',
                version: 8,
                reason: 'Проверено',
                idempotencyKey: '10000000-0000-4000-8000-000000000004',
            },
        }),
    );
});

void test('content workflow contracts and session-scoped keys reject incomplete commands and isolate staff sessions', () => {
    assert.equal(contentModerateSchema.safeParse(command('10000000-0000-4000-8000-000000000001').data).success, true);
    assert.equal(
        contentModerateSchema.safeParse({
            action: 'reject',
            version: 1,
            reason: '',
            idempotencyKey: '10000000-0000-4000-8000-000000000001',
        }).success,
        false,
    );
    assert.notDeepEqual(
        contentWorkflowKeys.workspace('session-a', 'queues', '10000000-0000-4000-8000-000000000001'),
        contentWorkflowKeys.workspace('session-b', 'queues', '10000000-0000-4000-8000-000000000001'),
    );
});
