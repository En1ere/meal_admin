import {
    contentCompareSchema,
    contentMergeSchema,
    contentModerateSchema,
    contentNotDuplicateSchema,
    contentResultSchema,
    type ContentCard,
    type ContentCommand,
    type ContentResult,
} from '../entities/content-workflow/index.js';
import type { AdminState } from './admin-model.js';

export class ContentMockError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
    }
}
function sanitizePublicReason(
    value: string | null | undefined,
    status: 'pending' | 'rejected' | 'hidden' | 'unpublished',
) {
    const normalized = value
        ?.replace(/[\u0000-\u001f\u007f]+/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim()
        .slice(0, 500);
    if (normalized) return normalized;
    if (status === 'rejected') return 'Рецепт требует исправлений перед повторной отправкой.';
    if (status === 'hidden') return 'Рецепт скрыт из публичного доступа после проверки.';
    if (status === 'unpublished') return 'Публикация рецепта снята после проверки.';
    return null;
}
function cards(state: AdminState): ContentCard[] {
    return (state.tables.brand_products ?? []).map((row) => {
        const composition = state.tables.composition_versions?.find((value) => value.product_id === row.id);
        return {
            id: String(row.id),
            version: Number(row.version ?? 1),
            name: String(row.name),
            fields: {
                name: String(row.name),
                brand: row.brand_id ? String(row.brand_id) : null,
                composition: composition?.composition_text ? String(composition.composition_text) : null,
                kcal: composition?.kcal ? String(composition.kcal) : null,
                protein: composition?.protein ? String(composition.protein) : null,
                fat: composition?.fat ? String(composition.fat) : null,
                carbs: composition?.carbs ? String(composition.carbs) : null,
            },
            variants: [
                JSON.stringify({ quantity: row.package_quantity, unit: row.package_unit_id, variant: row.variant_id }),
            ],
            authors: row.created_by ? [String(row.created_by)] : [],
            sources: composition?.source ? [String(composition.source)] : [],
            aliasOf: null,
        };
    });
}
export function ensureContentFixtures(state: AdminState) {
    if (state.tables.content_catalog_cards) return;
    const values = cards(state);
    const first = values[0];
    if (first)
        values.push({
            ...structuredClone(first),
            id: '10000000-0000-4000-8000-000000000107',
            name: 'Молоко 2,5% · кандидат',
            fields: { ...first.fields, name: 'Молоко 2,5% · кандидат' },
            variants: ['Тестовая фасовка 500 мл'],
        });
    state.tables.content_catalog_cards = values.map((value) => ({ id: value.id, payload: JSON.stringify(value) }));
}
function load(state: AdminState, section: 'queues' | 'catalog', id: string): ContentResult {
    ensureContentFixtures(state);
    const saved = state.tables.content_workspaces?.find((row) => row.id === id && row.section === section);
    const catalog = (state.tables.content_catalog_cards ?? []).map(
        (row) => JSON.parse(String(row.payload)) as ContentCard,
    );
    if (saved)
        return {
            ...contentResultSchema.parse(JSON.parse(String(saved.payload))),
            cards: catalog,
            comparison: null,
            message: '',
        };
    if (section === 'catalog') {
        const card = catalog.find((value) => value.id === id);
        if (!card) throw new ContentMockError(404, 'Карточка не найдена.');
        return {
            section,
            id,
            version: card.version,
            current: null,
            pending: null,
            review: null,
            publication: null,
            status: card.aliasOf ? 'merged' : 'active',
            history: [],
            cards: catalog,
            comparison: null,
            message: '',
        };
    }
    const queue = state.tables.moderation_cases?.find((row) => row.id === id);
    if (!queue) throw new ContentMockError(404, 'Материал не найден.');
    const revision = state.tables.recipe_revisions?.find((row) => row.id === queue.recipe_revision_id);
    const recipe = state.tables.recipes?.find((row) => row.id === revision?.recipe_id);
    const publication = state.tables.recipe_publications?.find(
        (row) => row.recipe_id === recipe?.id && row.unpublished_at === null,
    );
    const publishedRevision = state.tables.recipe_revisions?.find((row) => row.id === publication?.revision_id);
    const projection = (row: typeof revision | undefined) =>
        row
            ? {
                  id: String(row.id),
                  version: Number(row.revision ?? 1),
                  fields: {
                      title: String(row.title),
                      portions: String(row.portions),
                      method: String(row.method),
                      steps: (state.tables.recipe_steps ?? [])
                          .filter((step) => step.revision_id === row.id)
                          .map((step) => String(step.text))
                          .join('\n'),
                      author: recipe?.author_id ? String(recipe.author_id) : null,
                  },
              }
            : null;
    const reviewRevision = projection(revision);
    const publicationRevision = projection(publishedRevision);
    return {
        section,
        id,
        version: Number(queue.version ?? 1),
        status: String(queue.status),
        current: publicationRevision,
        pending: ['queued', 'pending', 'in_review', 'approved'].includes(String(queue.status)) ? reviewRevision : null,
        review: reviewRevision
            ? {
                  revisionId: reviewRevision.id,
                  status: String(queue.status),
                  publicReason: queue.public_reason ? String(queue.public_reason) : null,
                  revision: reviewRevision,
              }
            : null,
        publication: publicationRevision
            ? {
                  revisionId: publicationRevision.id,
                  publishedAt: String(publication?.published_at),
                  revision: publicationRevision,
              }
            : null,
        history: [],
        cards: catalog,
        comparison: null,
        message: '',
    };
}
export function contentWorkspaceCommand(
    state: AdminState,
    section: 'queues' | 'catalog',
    id: string,
    command: ContentCommand,
    context: { actorId: string; critical: boolean; now: number },
): ContentResult {
    const view = load(state, section, id);
    if (command.action === 'load') return view;
    const parsed =
        command.action === 'moderate'
            ? contentModerateSchema.safeParse(command.data)
            : command.action === 'compare'
              ? contentCompareSchema.safeParse(command.data)
              : command.action === 'merge'
                ? contentMergeSchema.safeParse(command.data)
                : contentNotDuplicateSchema.safeParse(command.data);
    if (!parsed.success) throw new ContentMockError(400, 'Проверьте поля команды.');
    if (
        section === 'catalog' &&
        command.action !== 'moderate' &&
        ![command.data.leftId, command.data.rightId].includes(id)
    )
        throw new ContentMockError(409, 'Маршрут должен принадлежать выбранной паре.');
    if (command.action === 'merge' && !context.critical)
        throw new ContentMockError(403, 'Требуется критичное подтверждение.');
    if (command.action === 'moderate' && !context.critical)
        throw new ContentMockError(403, 'Требуется критичное подтверждение.');
    const journal = (state.tables.content_commands ??= []);
    const digest = JSON.stringify({ section, id, command });
    const operation =
        command.action === 'moderate' ? `admin.content.${command.data.action}` : `admin.content.${command.action}`;
    const journalId = 'idempotencyKey' in command.data ? `${operation}:${id}:${command.data.idempotencyKey}` : null;
    if (journalId) {
        const previous = journal.find((row) => row.id === journalId && row.actor_id === context.actorId);
        if (previous) {
            if (previous.digest !== digest) throw new ContentMockError(409, 'Ключ команды уже использован.');
            return contentResultSchema.parse(JSON.parse(String(previous.result)));
        }
    }
    if (command.action === 'moderate') {
        if (section !== 'queues') throw new ContentMockError(400, 'Неверный раздел.');
        const c = contentModerateSchema.parse(command.data);
        const reviewRevision = view.review?.revision ?? view.pending;
        const publicationRevision = view.publication?.revision ?? view.current;
        if (c.version !== view.version) throw new ContentMockError(409, 'Материал изменился. Обновите версию.');
        const reviewAction = c.action === 'approve' || c.action === 'reject';
        if (
            reviewAction &&
            (!reviewRevision ||
                !['queued', 'pending', 'in_review', 'approved'].includes(view.review?.status ?? view.status))
        )
            throw new ContentMockError(409, 'Нет версии, ожидающей проверки.');
        if ((c.action === 'hide' || c.action === 'unpublish') && (!publicationRevision || view.status !== 'published'))
            throw new ContentMockError(409, 'Нет активной публикации этой редакции.');
        if (
            (c.action === 'hide' || c.action === 'unpublish') &&
            view.review &&
            view.publication &&
            view.review.revisionId !== view.publication.revisionId
        )
            throw new ContentMockError(409, 'Активная публикация относится к другой редакции.');
        const reviewRow = state.tables.recipe_revisions?.find((row) => row.id === reviewRevision?.id);
        const publicationRow = state.tables.recipe_revisions?.find((row) => row.id === publicationRevision?.id);
        const recipeId = reviewRow?.recipe_id ?? publicationRow?.recipe_id;
        const revisionSnapshot = JSON.stringify({ review: view.review, publication: view.publication });
        const nextPublicReason = sanitizePublicReason(
            c.publicReason,
            c.action === 'reject'
                ? 'rejected'
                : c.action === 'hide'
                  ? 'hidden'
                  : c.action === 'unpublish'
                    ? 'unpublished'
                    : 'pending',
        );
        if (c.action === 'approve') {
            for (const publication of state.tables.recipe_publications ?? [])
                if (publication.recipe_id === recipeId && publication.unpublished_at === null)
                    publication.unpublished_at = new Date(context.now).toISOString();
            (state.tables.recipe_publications ??= []).push({
                id: crypto.randomUUID(),
                recipe_id: String(recipeId),
                revision_id: String(reviewRow?.id),
                published_at: new Date(context.now).toISOString(),
                unpublished_at: null,
                decision_id: crypto.randomUUID(),
            });
            view.current = view.pending;
            view.pending = null;
            view.status = 'published';
            if (view.review) view.review = { ...view.review, status: 'published', publicReason: null };
            view.publication = view.review
                ? {
                      revisionId: view.review.revisionId,
                      publishedAt: new Date(context.now).toISOString(),
                      revision: view.review.revision,
                  }
                : null;
        }
        if (c.action === 'reject') {
            view.pending = null;
            view.status = 'rejected';
            if (view.review) view.review = { ...view.review, status: 'rejected', publicReason: nextPublicReason };
        }
        if (c.action === 'hide' || c.action === 'unpublish') {
            for (const publication of state.tables.recipe_publications ?? [])
                if (publication.recipe_id === recipeId && publication.unpublished_at === null)
                    publication.unpublished_at = new Date(context.now).toISOString();
            view.pending = null;
            view.current = null;
            view.publication = null;
            view.status = c.action === 'hide' ? 'hidden' : 'unpublished';
            if (view.review) view.review = { ...view.review, status: view.status, publicReason: nextPublicReason };
        }
        view.version++;
        (state.tables.content_revision_history ??= []).push({
            id: crypto.randomUUID(),
            case_id: id,
            before_snapshot: revisionSnapshot,
            action: c.action,
            reason: c.reason,
            actor_id: context.actorId,
        });
        const queue = state.tables.moderation_cases?.find((row) => row.id === id);
        if (queue) {
            queue.status = view.status;
            queue.version = String(view.version);
            queue.public_reason = nextPublicReason;
        }
    } else {
        if (section !== 'catalog') throw new ContentMockError(400, 'Неверный раздел.');
        const c = command.data;
        const left = view.cards.find((card) => card.id === c.leftId);
        const right = view.cards.find((card) => card.id === c.rightId);
        if (!left || !right || left.id === right.id || left.aliasOf || right.aliasOf)
            throw new ContentMockError(400, 'Выберите две разные активные карточки.');
        if (left.version !== c.leftVersion || right.version !== c.rightVersion)
            throw new ContentMockError(409, 'Карточки изменились. Повторите сравнение.');
        const pairKey = [left, right]
            .map((card) => `${card.id}:${card.version}`)
            .sort()
            .join('|');
        if (command.action === 'not-duplicate') {
            const ignored = (state.tables.content_not_duplicates ??= []);
            if (ignored.some((row) => row.id === pairKey))
                throw new ContentMockError(409, 'Эта пара уже закрыта как не дубли для текущих версий.');
            ignored.push({ id: pairKey, reason: command.data.reason });
            view.message = 'Пара закрыта до изменения данных сравнения.';
        } else {
            const c = command.data;
            if (state.tables.content_not_duplicates?.some((row) => row.id === pairKey))
                throw new ContentMockError(409, 'Эта пара уже отмечена как не дубли для текущих версий.');
            if (c.canonicalId !== left.id && c.canonicalId !== right.id)
                throw new ContentMockError(400, 'Выберите основную карточку из этой пары.');
            const conflicts = [...new Set([...Object.keys(left.fields), ...Object.keys(right.fields)])].filter(
                (field) => left.fields[field] !== right.fields[field],
            );
            const resolved: Record<string, string | null> = {};
            for (const field of Object.keys(left.fields)) {
                if (!conflicts.includes(field)) resolved[field] = left.fields[field] ?? null;
                else if (c.choices[field])
                    resolved[field] = (c.choices[field] === 'left' ? left : right).fields[field] ?? null;
            }
            const blockedReason =
                left.fields.composition !== right.fields.composition || !left.fields.composition
                    ? 'Составы отличаются или не подтверждены. Объединение недоступно до проверки состава.'
                    : null;
            const previewKey = JSON.stringify({ pairKey, canonicalId: c.canonicalId, resolved });
            view.comparison = {
                left,
                right,
                conflicts,
                resolved,
                canonicalId: c.canonicalId,
                previewKey,
                blockedReason,
            };
            if (command.action === 'compare') return view;
            if (blockedReason || conflicts.some((field) => !c.choices[field]) || command.data.previewKey !== previewKey)
                throw new ContentMockError(409, 'Разрешите все конфликты и обновите предпросмотр.');
            const canonical = c.canonicalId === left.id ? left : right;
            const alias = canonical === left ? right : left;
            const beforeSnapshot = JSON.stringify(view.comparison);
            canonical.fields = resolved;
            canonical.name = resolved.name ?? canonical.name;
            canonical.variants = [...new Set([...left.variants, ...right.variants])];
            canonical.sources = [...new Set([...left.sources, ...right.sources])];
            canonical.authors = [...new Set([...left.authors, ...right.authors])];
            canonical.version++;
            alias.aliasOf = canonical.id;
            alias.version++;
            state.tables.content_catalog_cards = view.cards.map((card) => ({
                id: card.id,
                payload: JSON.stringify(card),
            }));
            (state.tables.catalog_merges ??= []).push({
                id: crypto.randomUUID(),
                source_id: alias.id,
                target_id: canonical.id,
                reason: command.data.reason,
                before_snapshot: beforeSnapshot,
            });
            view.message =
                'Карточки объединены. Старый ID сохранён как ссылка; фасовки и исторические записи сохранены.';
            view.comparison = null;
            view.version++;
        }
    }
    view.history.push({
        action: command.action === 'moderate' ? command.data.action : command.action,
        reason: 'reason' in command.data ? command.data.reason : '',
        actor: context.actorId,
        at: new Date(context.now).toISOString(),
    });
    const storage = (state.tables.content_workspaces ??= []);
    const stored = storage.find((row) => row.id === id && row.section === section);
    if (stored) stored.payload = JSON.stringify(view);
    else storage.push({ id, section, payload: JSON.stringify(view) });
    if (journalId)
        journal.push({
            id: journalId,
            actor_id: context.actorId,
            digest,
            result: JSON.stringify(view),
        });
    (state.tables.audit_events ??= []).push({
        id: crypto.randomUUID(),
        actor_id: context.actorId,
        action: operation,
        target_id: id,
        created_at: new Date(context.now).toISOString(),
    });
    return view;
}
