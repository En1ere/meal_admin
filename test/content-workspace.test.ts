import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdminState } from '../src/mocks/admin-model.js';
import { contentWorkspaceCommand, ContentMockError } from '../src/mocks/content-workspace.js';
import {
    contentActionAvailable,
    contentReviewStatusLabel,
    type ContentCompare,
    type ContentResult,
} from '../src/entities/content-workflow/index.js';
const context = { actorId: crypto.randomUUID(), critical: true, now: Date.now() };
const id = '10000000-0000-4000-8000-000000000007';
const queueId = '10000000-0000-4000-8000-000000000001';
function comparison(view: ContentResult): ContentCompare {
    const left = view.cards[0]!;
    const right = view.cards[1]!;
    return {
        leftId: left.id,
        rightId: right.id,
        leftVersion: left.version,
        rightVersion: right.version,
        canonicalId: left.id,
        choices: { name: 'left' },
    };
}
void test('moderation rejects pending revision without removing approved public version; reason and optimistic version required', () => {
    const state = createAdminState();
    const view = contentWorkspaceCommand(state, 'queues', queueId, { action: 'load' }, context);
    assert.ok(view.pending);
    assert.equal(view.review?.status, 'pending');
    assert.equal(view.current?.version, 1);
    assert.equal(view.publication?.revision.version, 1);
    assert.equal(view.pending?.version, 2);
    state.tables.content_workspaces = [{ id: queueId, section: 'queues', payload: JSON.stringify(view) }];
    assert.throws(
        () =>
            contentWorkspaceCommand(
                state,
                'queues',
                queueId,
                {
                    action: 'moderate',
                    data: {
                        action: 'reject',
                        version: 1,
                        reason: '',
                        publicReason: 'Уточните состав',
                        idempotencyKey: crypto.randomUUID(),
                    },
                },
                context,
            ),
        ContentMockError,
    );
    const publicationsBefore = JSON.stringify(state.tables.recipe_publications);
    const auditBefore = state.tables.audit_events?.length ?? 0;
    assert.throws(
        () =>
            contentWorkspaceCommand(
                state,
                'queues',
                queueId,
                {
                    action: 'moderate',
                    data: {
                        action: 'reject',
                        version: 999,
                        reason: 'Служебная причина',
                        publicReason: 'Причина для автора',
                        idempotencyKey: crypto.randomUUID(),
                    },
                },
                context,
            ),
        (error) => error instanceof ContentMockError && error.status === 409,
    );
    assert.equal(JSON.stringify(state.tables.recipe_publications), publicationsBefore);
    assert.equal(state.tables.content_revision_history?.length ?? 0, 0);
    assert.equal(state.tables.audit_events?.length ?? 0, auditBefore);
    const result = contentWorkspaceCommand(
        state,
        'queues',
        queueId,
        {
            action: 'moderate',
            data: {
                action: 'reject',
                version: 1,
                reason: 'Внутренняя заметка о проверке',
                publicReason: 'Уточните состав',
                idempotencyKey: crypto.randomUUID(),
            },
        },
        context,
    );
    assert.equal(result.current?.fields.title, 'Ранее опубликованная молочная каша');
    assert.equal(result.pending, null);
    assert.equal(result.publication?.revision.version, 1);
    assert.equal(result.review?.revision.version, 2);
    assert.equal(result.review?.status, 'rejected');
    assert.equal(result.review?.publicReason, 'Уточните состав');
    assert.equal(result.history[0]?.reason, 'Внутренняя заметка о проверке');
    assert.equal(state.tables.moderation_cases?.[0]?.public_reason, 'Уточните состав');
    assert.doesNotMatch(result.review?.publicReason ?? '', /Внутренняя заметка/u);
});

void test('moderation requires fresh critical confirmation before any decision', () => {
    const state = createAdminState();
    assert.throws(
        () =>
            contentWorkspaceCommand(
                state,
                'queues',
                queueId,
                {
                    action: 'moderate',
                    data: {
                        action: 'reject',
                        version: 1,
                        reason: 'Внутренняя причина',
                        publicReason: 'Причина для автора',
                        idempotencyKey: crypto.randomUUID(),
                    },
                },
                { ...context, critical: false },
            ),
        (error) => error instanceof ContentMockError && error.status === 403,
    );
});

void test('public reason is sanitized independently and receives an author-safe default', () => {
    const state = createAdminState();
    const result = contentWorkspaceCommand(
        state,
        'queues',
        queueId,
        {
            action: 'moderate',
            data: {
                action: 'reject',
                version: 1,
                reason: 'INTERNAL_ONLY_TOKEN',
                publicReason: '  Исправьте\u0000  список\nингредиентов  ',
                idempotencyKey: crypto.randomUUID(),
            },
        },
        context,
    );
    assert.equal(result.review?.publicReason, 'Исправьте список ингредиентов');
    assert.doesNotMatch(result.review?.publicReason ?? '', /INTERNAL_ONLY_TOKEN/u);
    assert.match(result.history[0]?.reason ?? '', /INTERNAL_ONLY_TOKEN/u);

    const defaultState = createAdminState();
    const withDefault = contentWorkspaceCommand(
        defaultState,
        'queues',
        queueId,
        {
            action: 'moderate',
            data: {
                action: 'reject',
                version: 1,
                reason: 'Служебная причина',
                idempotencyKey: crypto.randomUUID(),
            },
        },
        context,
    );
    assert.equal(withDefault.review?.publicReason, 'Рецепт требует исправлений перед повторной отправкой.');
});

void test('hide and unpublish reject a publication from a different review revision', () => {
    const state = createAdminState();
    const view = contentWorkspaceCommand(state, 'queues', queueId, { action: 'load' }, context);
    assert.ok(view.review && view.publication);
    view.status = 'published';
    view.review.status = 'published';
    state.tables.content_workspaces = [{ id: queueId, section: 'queues', payload: JSON.stringify(view) }];
    assert.equal(contentActionAvailable(view, 'hide'), false);
    assert.throws(
        () =>
            contentWorkspaceCommand(
                state,
                'queues',
                queueId,
                {
                    action: 'moderate',
                    data: {
                        action: 'hide',
                        version: 1,
                        reason: 'Служебная причина',
                        publicReason: 'Скрыто после проверки',
                        idempotencyKey: crypto.randomUUID(),
                    },
                },
                context,
            ),
        (error) => error instanceof ContentMockError && error.status === 409,
    );
});

void test('legacy content payload without revision axes remains readable during rollback', () => {
    const state = createAdminState();
    const current = contentWorkspaceCommand(state, 'queues', queueId, { action: 'load' }, context);
    const legacy = { ...current };
    delete legacy.review;
    delete legacy.publication;
    state.tables.content_workspaces = [{ id: queueId, section: 'queues', payload: JSON.stringify(legacy) }];
    const result = contentWorkspaceCommand(state, 'queues', queueId, { action: 'load' }, context);
    assert.equal(result.review, undefined);
    assert.equal(result.publication, undefined);
    assert.equal(contentActionAvailable(result, 'approve'), true);
    const approved = contentWorkspaceCommand(
        state,
        'queues',
        queueId,
        {
            action: 'moderate',
            data: {
                action: 'approve',
                version: result.version,
                reason: '',
                publicReason: null,
                idempotencyKey: crypto.randomUUID(),
            },
        },
        context,
    );
    assert.equal(approved.status, 'published');
    assert.equal(approved.current?.version, 2);
});

void test('full admin approve atomically replaces the active publication and action gates follow case status', () => {
    const state = createAdminState();
    const before = contentWorkspaceCommand(state, 'queues', queueId, { action: 'load' }, context);
    assert.equal(contentActionAvailable(before, 'approve'), true);
    assert.equal(contentActionAvailable(before, 'hide'), false);
    const result = contentWorkspaceCommand(
        state,
        'queues',
        queueId,
        {
            action: 'moderate',
            data: {
                action: 'approve',
                version: 1,
                reason: '',
                publicReason: null,
                idempotencyKey: crypto.randomUUID(),
            },
        },
        context,
    );
    assert.equal(result.status, 'published');
    assert.equal(result.current?.version, 2);
    assert.equal(result.publication?.revision.version, 2);
    assert.equal(result.review?.status, 'published');
    assert.equal(result.pending, null);
    assert.equal(contentActionAvailable(result, 'approve'), false);
    assert.equal(contentActionAvailable(result, 'hide'), true);
    assert.equal(contentReviewStatusLabel(result.status), 'Опубликовано');
    const publications = state.tables.recipe_publications ?? [];
    assert.equal(publications.filter((publication) => publication.unpublished_at === null).length, 1);
    assert.equal(
        publications.find((publication) => publication.unpublished_at === null)?.revision_id,
        result.current?.id,
    );
});
void test('merge preserves variants, source IDs and historical tables; retries are idempotent', () => {
    const state = createAdminState();
    const historic = JSON.stringify(state.tables.recipe_ingredients);
    const view = contentWorkspaceCommand(state, 'catalog', id, { action: 'load' }, context);
    const data = comparison(view);
    const preview = contentWorkspaceCommand(state, 'catalog', id, { action: 'compare', data }, context).comparison!;
    const command = {
        action: 'merge' as const,
        data: { ...data, previewKey: preview.previewKey, reason: 'Один товар', idempotencyKey: crypto.randomUUID() },
    };
    const result = contentWorkspaceCommand(state, 'catalog', id, command, context);
    assert.throws(
        () => contentWorkspaceCommand(state, 'catalog', id, command, { ...context, critical: false }),
        (error) => error instanceof ContentMockError && error.status === 403,
    );
    assert.deepEqual(contentWorkspaceCommand(state, 'catalog', id, command, context), result);
    assert.equal(result.cards[1]?.aliasOf, id);
    assert.equal(result.cards[0]?.variants.length, 2);
    assert.equal(JSON.stringify(state.tables.recipe_ingredients), historic);
    assert.equal(state.tables.catalog_merges?.length, 1);
    assert.equal(state.tables.content_commands?.length, 1);
    assert.equal(state.tables.audit_events?.filter((event) => event.action === 'admin.content.merge').length, 1);
});
void test('merge requires critical confirmation, all conflicts and exact preview', () => {
    const state = createAdminState();
    const view = contentWorkspaceCommand(state, 'catalog', id, { action: 'load' }, context);
    const data = comparison(view);
    const preview = contentWorkspaceCommand(state, 'catalog', id, { action: 'compare', data }, context).comparison!;
    const command = {
        action: 'merge' as const,
        data: { ...data, previewKey: preview.previewKey, reason: 'Проверено', idempotencyKey: crypto.randomUUID() },
    };
    assert.throws(
        () => contentWorkspaceCommand(state, 'catalog', id, command, { ...context, critical: false }),
        (e) => e instanceof ContentMockError && e.status === 403,
    );
    assert.throws(
        () =>
            contentWorkspaceCommand(
                state,
                'catalog',
                id,
                { ...command, data: { ...command.data, choices: {} } },
                context,
            ),
        ContentMockError,
    );
    assert.throws(
        () =>
            contentWorkspaceCommand(
                state,
                'catalog',
                id,
                { ...command, data: { ...command.data, previewKey: 'stale' } },
                context,
            ),
        ContentMockError,
    );
});
void test('not-duplicate suppresses pair for same comparison revisions; composition differences block merge', () => {
    const state = createAdminState();
    const view = contentWorkspaceCommand(state, 'catalog', id, { action: 'load' }, context);
    const data = comparison(view);
    const command = {
        action: 'not-duplicate' as const,
        data: {
            leftId: data.leftId,
            rightId: data.rightId,
            leftVersion: 1,
            rightVersion: 1,
            reason: 'Другой состав',
            idempotencyKey: crypto.randomUUID(),
        },
    };
    const result = contentWorkspaceCommand(state, 'catalog', id, command, context);
    assert.deepEqual(contentWorkspaceCommand(state, 'catalog', id, command, context), result);
    assert.equal(state.tables.content_not_duplicates?.length, 1);
    assert.equal(state.tables.content_commands?.length, 1);
    assert.equal(
        state.tables.audit_events?.filter((event) => event.action === 'admin.content.not-duplicate').length,
        1,
    );
    assert.throws(
        () =>
            contentWorkspaceCommand(
                state,
                'catalog',
                id,
                { ...command, data: { ...command.data, idempotencyKey: crypto.randomUUID() } },
                context,
            ),
        (error) => error instanceof ContentMockError && error.status === 409,
    );
    assert.equal(state.tables.content_not_duplicates?.length, 1);
    assert.equal(state.tables.content_commands?.length, 1);
    assert.equal(
        state.tables.audit_events?.filter((event) => event.action === 'admin.content.not-duplicate').length,
        1,
    );
    assert.throws(
        () => contentWorkspaceCommand(state, 'catalog', id, { action: 'compare', data }, context),
        ContentMockError,
    );
    const row = state.tables.content_catalog_cards![1]!;
    const changed = view.cards[1]!;
    changed.version++;
    changed.fields.composition = 'Молоко и сахар';
    row.payload = JSON.stringify(changed);
    const updated = { ...data, rightVersion: 2 };
    const preview = contentWorkspaceCommand(
        state,
        'catalog',
        id,
        { action: 'compare', data: updated },
        context,
    ).comparison!;
    assert.match(preview.blockedReason!, /Составы/);
});

void test('idempotency is bound to actor, operation and target; changed payload for the same binding conflicts', () => {
    const state = createAdminState();
    const key = crypto.randomUUID();
    const moderation = {
        action: 'moderate' as const,
        data: { action: 'reject' as const, version: 1, reason: 'Не подтверждено', idempotencyKey: key },
    };
    contentWorkspaceCommand(state, 'queues', queueId, moderation, context);
    assert.throws(
        () =>
            contentWorkspaceCommand(
                state,
                'queues',
                queueId,
                { ...moderation, data: { ...moderation.data, reason: 'Изменённая причина' } },
                context,
            ),
        (error) => error instanceof ContentMockError && error.status === 409,
    );

    const view = contentWorkspaceCommand(state, 'catalog', id, { action: 'load' }, context);
    const data = comparison(view);
    contentWorkspaceCommand(
        state,
        'catalog',
        id,
        {
            action: 'not-duplicate',
            data: {
                leftId: data.leftId,
                rightId: data.rightId,
                leftVersion: data.leftVersion,
                rightVersion: data.rightVersion,
                reason: 'Разные товары',
                idempotencyKey: key,
            },
        },
        context,
    );
    assert.equal(state.tables.content_commands?.length, 2);
});

void test('catalog route target must belong to the selected pair', () => {
    const state = createAdminState();
    const view = contentWorkspaceCommand(state, 'catalog', id, { action: 'load' }, context);
    const unrelatedId = '10000000-0000-4000-8000-000000000207';
    state.tables.content_catalog_cards!.push({
        id: unrelatedId,
        payload: JSON.stringify({ ...view.cards[0], id: unrelatedId, name: 'Несвязанная карточка' }),
    });
    assert.throws(
        () =>
            contentWorkspaceCommand(
                state,
                'catalog',
                unrelatedId,
                { action: 'compare', data: comparison(view) },
                context,
            ),
        (error) => error instanceof ContentMockError && error.status === 409,
    );
});
