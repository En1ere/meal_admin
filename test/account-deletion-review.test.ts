import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accountDeletionReviewHandle } from '../src/mocks/account-deletion-review.js';
import { createSeed } from '../src/mocks/model.js';
import type { Principal } from '../src/shared/api/contracts.generated.js';

void test('account-deletion review replays one effect and rejects a changed payload for the same key', async () => {
    const state = createSeed();
    const now = Date.parse('2026-10-27T12:00:00.000Z');
    const id = '20000000-0000-4000-8000-000000000070';
    const actor: Principal = {
        id: state.users.find((user) => user.role === 'admin')!.id,
        displayName: 'Admin',
        context: 'admin',
        sessionId: crypto.randomUUID(),
        expiresAt: new Date(now + 3600000).toISOString(),
    };
    state.admin.tables.legal_requests!.push({
        id,
        kind: 'account_deletion',
        status: 'requested',
        requested_at: new Date(now - 3600000).toISOString(),
        created_at: new Date(now - 3600000).toISOString(),
        version: '1',
    });
    const input = {
        decision: 'approve',
        expectedVersion: 1,
        reason: 'Identity and retention policy verified',
        idempotencyKey: crypto.randomUUID(),
    };
    const send = (body: unknown, critical = true) =>
        accountDeletionReviewHandle({
            state,
            actor,
            critical,
            now,
            path: `/api/v1/admin/account-deletions/${id}/review`,
            method: 'POST',
            body,
            requestId: crypto.randomUUID(),
            success: (data) => Response.json(data),
            fail: (status) => new Response(null, { status }),
        })!;

    const first = send(input);
    const replay = send(input);
    assert.equal(first.status, 200);
    assert.equal(replay.status, 200);
    assert.deepEqual(await replay.json(), await first.json());
    assert.equal(
        state.admin.tables.legal_request_steps!.filter((step) => step.request_id === id && step.kind === 'admin_review')
            .length,
        1,
    );
    assert.equal(
        state.admin.tables.audit_events!.filter(
            (event) => event.target_id === id && event.action === 'account.deletion.approved',
        ).length,
        1,
    );
    assert.equal(send({ ...input, reason: 'Changed reason cannot reuse the operation key' }).status, 409);
    assert.equal(send(input, false).status, 403);
});

void test('account-deletion review accepts only backend reviewable lifecycle states', () => {
    for (const [status, expected] of [
        ['requested', 200],
        ['retention_wait', 200],
        ['blocked', 200],
        ['pending', 409],
        ['ready', 409],
        ['cancelled', 409],
        ['rejected', 409],
        ['finalized', 409],
    ] as const) {
        const state = createSeed();
        const now = Date.parse('2026-10-27T12:00:00.000Z');
        const id = crypto.randomUUID();
        const admin = state.users.find((user) => user.role === 'admin')!;
        const actor: Principal = {
            id: admin.id,
            displayName: admin.name,
            context: 'admin',
            sessionId: crypto.randomUUID(),
            expiresAt: new Date(now + 3600000).toISOString(),
        };
        state.admin.tables.legal_requests!.push({
            id,
            kind: 'account_deletion',
            status,
            requested_at: new Date(now - 3600000).toISOString(),
            version: '1',
        });
        const response = accountDeletionReviewHandle({
            state,
            actor,
            critical: true,
            now,
            path: `/api/v1/admin/account-deletions/${id}/review`,
            method: 'POST',
            body: {
                decision: 'approve',
                expectedVersion: 1,
                reason: 'Lifecycle state verified before review',
                idempotencyKey: crypto.randomUUID(),
            },
            requestId: crypto.randomUUID(),
            success: (data) => Response.json(data),
            fail: (code) => new Response(null, { status: code }),
        })!;
        assert.equal(response.status, expected, status);
    }
});
