import assert from 'node:assert/strict';
import test from 'node:test';
import {
    complianceReviewKeys,
    isAccountDeletionReviewable,
    reviewExecuteSchema,
} from '../src/entities/compliance-review/index.js';

void test('compliance review cache keys isolate staff sessions and workspace sections', () => {
    const id = '10000000-0000-4000-8000-000000000011';
    assert.deepEqual(complianceReviewKeys.root, ['compliance-review']);
    assert.deepEqual(complianceReviewKeys.forSession('session-a'), ['compliance-review', 'session-a']);
    assert.deepEqual(complianceReviewKeys.workspace('session-a', 'rollback', id), [
        'compliance-review',
        'session-a',
        'rollback',
        id,
    ]);
    assert.notDeepEqual(
        complianceReviewKeys.workspace('session-a', 'rollback', id),
        complianceReviewKeys.workspace('session-b', 'rollback', id),
    );
    assert.notDeepEqual(
        complianceReviewKeys.workspace('session-a', 'rollback', id),
        complianceReviewKeys.workspace('session-a', 'legal-requests', id),
    );
});

void test('compliance execute contract keeps version, preview and idempotency bounded', () => {
    const valid = {
        version: 1,
        previewKey: 'preview',
        reason: 'Подтверждённая причина',
        idempotencyKey: '10000000-0000-4000-8000-000000000099',
    };
    assert.equal(reviewExecuteSchema.safeParse(valid).success, true);
    assert.equal(reviewExecuteSchema.safeParse({ ...valid, previewKey: '' }).success, false);
    assert.equal(reviewExecuteSchema.safeParse({ ...valid, reason: 'x'.repeat(2001) }).success, false);
    assert.equal(reviewExecuteSchema.safeParse({ ...valid, idempotencyKey: 'not-a-uuid' }).success, false);
});

void test('account-deletion review is fail-closed outside backend reviewable states', () => {
    for (const status of ['requested', 'retention_wait', 'blocked']) {
        assert.equal(isAccountDeletionReviewable(status), true, status);
    }
    for (const status of ['pending', 'ready', 'cancelled', 'rejected', 'finalized', 'unknown', '', null, undefined]) {
        assert.equal(isAccountDeletionReviewable(status), false, String(status));
    }
});
