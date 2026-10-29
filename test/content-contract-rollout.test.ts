import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../src/shared/api/client.js';

const caseId = '10000000-0000-4000-8000-000000000001';
const revisionId = '10000000-0000-4000-8000-000000000045';
const requestId = '10000000-0000-4000-8000-000000000003';
const revision = { id: revisionId, version: 2, fields: { title: 'Каша' } };
const legacyData = {
    section: 'queues',
    id: caseId,
    version: 1,
    current: null,
    pending: revision,
    status: 'pending',
    history: [],
    cards: [],
    comparison: null,
    message: '',
};
const success = (data: unknown) => Response.json({ data, meta: { requestId } });
const command = {
    action: 'reject' as const,
    version: 1,
    reason: 'Служебная причина',
    publicReason: 'Причина для автора',
    idempotencyKey: '10000000-0000-4000-8000-000000000004',
};

function pathOf(url: string | URL | Request) {
    return new URL(url instanceof Request ? url.url : url.toString()).pathname;
}

function recordBody(init: RequestInit | undefined, sent: Record<string, unknown>[]) {
    if (typeof init?.body === 'string') sent.push(JSON.parse(init.body) as Record<string, unknown>);
}

void test('admin content rollout normalizes legacy responses and omits unsupported publicReason', async () => {
    const sent: Record<string, unknown>[] = [];
    const client = new ApiClient('http://localhost:3002', (url, init) => {
        if (pathOf(url).endsWith('/auth/csrf')) return Promise.resolve(success({ token: 'c'.repeat(43) }));
        recordBody(init, sent);
        return Promise.resolve(success(legacyData));
    });
    const loaded = await client.request('GET /api/v1/admin/content-workspace/{section}/{id}', undefined, undefined, {
        section: 'queues',
        id: caseId,
    });
    assert.equal(loaded.data.review, null);
    assert.equal(loaded.data.publication, null);
    assert.equal(loaded.data.pending?.id, revisionId);
    await client.request('POST /api/v1/admin/content-workspace/{section}/{id}/moderate', command, undefined, {
        section: 'queues',
        id: caseId,
    });
    assert.equal(Object.hasOwn(sent.at(-1)!, 'publicReason'), false);
});

void test('admin content rollout does not conceal a partial revision-axis response', async () => {
    const client = new ApiClient('http://localhost:3002', () =>
        Promise.resolve(success({ ...legacyData, review: null })),
    );
    await assert.rejects(
        client.request('GET /api/v1/admin/content-workspace/{section}/{id}', undefined, undefined, {
            section: 'queues',
            id: caseId,
        }),
    );
});

void test('malformed strict axes do not enable the new request capability', async () => {
    const sent: Record<string, unknown>[] = [];
    let malformed = true;
    const client = new ApiClient('http://localhost:3002', (url, init) => {
        if (pathOf(url).endsWith('/auth/csrf')) return Promise.resolve(success({ token: 'c'.repeat(43) }));
        recordBody(init, sent);
        if (malformed) {
            malformed = false;
            return Promise.resolve(success({ ...legacyData, review: null, publication: {} }));
        }
        return Promise.resolve(success(legacyData));
    });
    await assert.rejects(
        client.request('GET /api/v1/admin/content-workspace/{section}/{id}', undefined, undefined, {
            section: 'queues',
            id: caseId,
        }),
    );
    await client.request('POST /api/v1/admin/content-workspace/{section}/{id}/moderate', command, undefined, {
        section: 'queues',
        id: caseId,
    });
    assert.equal(Object.hasOwn(sent.at(-1)!, 'publicReason'), false);
});

void test('admin content rollout preserves strict new axes and sends publicReason only while capability is current', async () => {
    const sent: Record<string, unknown>[] = [];
    const strictData = {
        ...legacyData,
        review: { revisionId, status: 'pending', publicReason: null, revision },
        publication: null,
    };
    const client = new ApiClient('http://localhost:3002', (url, init) => {
        if (pathOf(url).endsWith('/auth/csrf')) return Promise.resolve(success({ token: 'c'.repeat(43) }));
        recordBody(init, sent);
        return Promise.resolve(success(strictData));
    });
    await client.request('GET /api/v1/admin/content-workspace/{section}/{id}', undefined, undefined, {
        section: 'queues',
        id: caseId,
    });
    await client.request('POST /api/v1/admin/content-workspace/{section}/{id}/moderate', command, undefined, {
        section: 'queues',
        id: caseId,
    });
    assert.equal(sent.at(-1)?.publicReason, command.publicReason);

    client.invalidate();
    await client.request('POST /api/v1/admin/content-workspace/{section}/{id}/moderate', command, undefined, {
        section: 'queues',
        id: caseId,
    });
    assert.equal(Object.hasOwn(sent.at(-1)!, 'publicReason'), false);
});
