import type { ApiClient } from '../../shared/api/client.js';
import {
    canonicalDetailSchema,
    conditionModel,
    conditionPayload,
    serializeChanges,
    stableUuid,
    type Release,
    type ReleaseAck,
    type ReleaseChange,
    type ReleaseCommand,
    type ReleaseWorkspace,
} from '../../entities/content-release/index.js';

export { conditionModel, conditionPayload, serializeChanges, stableUuid };

const categoryToGroup = {
    culinary: 'culinary',
    inventory: 'inventory_planning',
    planning: 'inventory_planning',
    author: 'author',
    community: 'community_catalog',
    catalog: 'community_catalog',
    collections: 'collections_family',
    family: 'collections_family',
    seasonal: 'seasonal_secret',
    secret: 'seasonal_secret',
} as const;
export async function sha256(value: unknown) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function mapChanges(
    input: unknown,
    rankSources: ReleaseWorkspace['ranks'],
    achievementSources: ReleaseWorkspace['achievements'],
    documentSources: ReleaseWorkspace['contentDocuments'],
    dictionarySources: ReleaseWorkspace['dictionaryEntries'],
): ReleaseChange[] {
    const patches = canonicalDetailSchema.shape.patches.parse(input);
    const result: ReleaseChange[] = [];
    const rankPatches = patches.filter((patch) => patch.resourceType === 'reputation_title');
    for (const patch of patches) {
        if (patch.resourceType === 'achievement' && patch.action !== 'retire')
            result.push({
                entityType: 'achievement',
                entityId:
                    achievementSources.find((item) => item.code === patch.resourceKey)?.id ??
                    stableUuid(`achievement-${patch.resourceKey}`),
                label: patch.payload.title,
                changeType: patch.action === 'create' ? 'add' : 'update',
                expectedVersion: patch.expectedVersion,
                achievement: {
                    code: patch.payload.code,
                    title: patch.payload.title,
                    description: patch.payload.description,
                    icon: patch.payload.icon,
                    group: categoryToGroup[patch.payload.category],
                    condition: conditionModel(patch.payload.condition),
                    secret: patch.payload.secret,
                },
            });
        else if (patch.resourceType === 'achievement') {
            const source = achievementSources.find((item) => item.code === patch.resourceKey);
            if (source) {
                const achievement = {
                    code: source.code,
                    title: source.title,
                    description: source.description,
                    group: source.group,
                    condition: source.condition,
                    secret: source.secret,
                    icon: source.icon,
                };
                result.push({
                    entityType: 'achievement',
                    entityId: source.id,
                    label: source.title,
                    changeType: 'retire',
                    expectedVersion: patch.expectedVersion,
                    achievement,
                });
            }
        } else if (patch.resourceType === 'legal_text')
            result.push({
                entityType: 'legal_text',
                entityId: stableUuid(`legal-${patch.resourceKey}`),
                label: patch.payload.kind,
                changeType: patch.action === 'create' ? 'add' : 'update',
                expectedVersion: patch.expectedVersion,
                summary: patch.payload.content,
                effectiveAt: patch.payload.effectiveAt,
            });
        else if (patch.resourceType === 'product_description')
            result.push({
                entityType: 'product_description',
                entityId: patch.payload.productId,
                label: patch.resourceKey,
                changeType: patch.action === 'create' ? 'add' : 'update',
                expectedVersion: patch.expectedVersion,
                summary: patch.payload.description,
            });
        else if (patch.resourceType === 'content_document') {
            const source = documentSources.find((item) => item.key === patch.resourceKey);
            const document = patch.action === 'retire' ? source?.value : patch.payload;
            if (document)
                result.push({
                    entityType: 'content_document',
                    entityId: stableUuid(`document-${patch.resourceKey}`),
                    resourceKey: patch.resourceKey,
                    label: document.title,
                    changeType: patch.action === 'create' ? 'add' : patch.action,
                    expectedVersion: patch.expectedVersion,
                    document,
                });
        } else if (patch.resourceType === 'dictionary_entry') {
            const source = dictionarySources.find((item) => item.key === patch.resourceKey);
            const entry = patch.action === 'retire' ? source?.value : patch.payload;
            if (entry)
                result.push({
                    entityType: 'dictionary_entry',
                    entityId: stableUuid(`dictionary-${patch.resourceKey}`),
                    resourceKey: patch.resourceKey,
                    label: entry.label,
                    changeType: patch.action === 'create' ? 'add' : patch.action,
                    expectedVersion: patch.expectedVersion,
                    entry,
                });
        }
    }
    if (rankPatches.length)
        result.push({
            entityType: 'reputation',
            entityId: stableUuid('reputation-scale'),
            label: 'Шкала репутации',
            changeType: 'update',
            ranks: rankPatches
                .toSorted(
                    (a, b) =>
                        (a.resourceType === 'reputation_title' ? a.payload.level : 0) -
                        (b.resourceType === 'reputation_title' ? b.payload.level : 0),
                )
                .map((patch, index) =>
                    patch.resourceType === 'reputation_title'
                        ? {
                              id: stableUuid(`rank-${patch.payload.level}`),
                              minimum: patch.payload.threshold,
                              title: patch.payload.title,
                              version: patch.expectedVersion,
                          }
                        : rankSources[index]!,
                ),
        });
    return result;
}
async function fetchWorkspace(api: ApiClient, signal?: AbortSignal): Promise<ReleaseWorkspace> {
    const [list, history, sources] = await Promise.all([
        api.request('GET /api/v1/admin/content-releases', undefined, signal),
        api.request('GET /api/v1/admin/content-releases/history', undefined, signal),
        api.request('GET /api/v1/admin/content-releases/sources', undefined, signal),
    ]);
    const sourceRanks = sources.data.reputationTitles
        .toSorted((a, b) => a.value.level - b.value.level)
        .map((item) => ({
            id: stableUuid(`rank-${item.key}`),
            minimum: item.value.threshold,
            title: item.value.title,
            version: item.version,
        }));
    const defaults = [
        [0, 'Новичок'],
        [25, 'Участник'],
        [75, 'Помощник'],
        [150, 'Знаток'],
        [300, 'Автор'],
        [600, 'Эксперт'],
        [1000, 'Наставник'],
        [1750, 'Мастер'],
        [3000, 'Шеф сообщества'],
        [5000, 'Легенда'],
    ] as const;
    const ranks =
        sourceRanks.length === 10
            ? sourceRanks
            : defaults.map(([minimum, title], index) => ({
                  id: stableUuid(`rank-${index + 1}`),
                  minimum,
                  title,
                  version: 0,
              }));
    const achievements = sources.data.achievements
        .filter((item) => !item.retired)
        .map((item) => ({
            id: stableUuid(`achievement-${item.key}`),
            code: item.value.code,
            title: item.value.title,
            description: item.value.description,
            group: categoryToGroup[item.value.category],
            condition: conditionModel(item.value.condition),
            secret: item.value.secret,
            icon: item.value.icon,
            version: item.version,
            updatedAt: new Date(0).toISOString(),
        }));
    const details = await Promise.all(
        list.data.items.map((item) =>
            api.request('GET /api/v1/admin/content-releases/{id}', undefined, signal, { id: item.id }),
        ),
    );
    const releases: Release[] = details.map(({ data }) => ({
        id: data.id,
        title: data.name,
        status: data.status === 'published' ? 'published' : data.validation.valid ? 'ready' : 'draft',
        version: data.version,
        clientRevision: data.ack?.clientRevision ?? 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        publishedAt: data.publishedAt,
        rolledBackAt: data.rolledBackFromEventId ? data.updatedAt : null,
        changes: mapChanges(
            data.patches,
            ranks,
            achievements,
            sources.data.contentDocuments,
            sources.data.dictionaryEntries,
        ),
        validation: {
            errors: data.validation.errors,
            warnings: data.validation.conflicts,
            validatedVersion: data.validation.valid ? data.version : null,
        },
        events: history.data.items
            .filter((event) => event.releaseId === data.id)
            .map((event) => ({
                id: event.id,
                kind: event.kind,
                at: event.createdAt,
                actor: 'admin',
                version: data.version,
            })),
    }));
    return {
        releases,
        achievements,
        ranks,
        legalTexts: sources.data.legalTexts
            .filter((item) => !item.retired)
            .map((item) => ({
                key: item.key,
                version: item.version,
                content: item.value.content,
                effectiveAt: item.value.effectiveAt,
            })),
        products: sources.data.products,
        contentDocuments: sources.data.contentDocuments,
        dictionaryEntries: sources.data.dictionaryEntries,
        rollbackSnapshots: {},
        serverRevision: 1,
    };
}
export const loadReleaseWorkspace = fetchWorkspace;
export async function runReleaseCommand(
    api: ApiClient,
    command: ReleaseCommand,
    signal?: AbortSignal,
): Promise<ReleaseAck> {
    let message = '',
        ack: ReleaseAck['ack'] = null;
    if (command.action === 'create') {
        await api.request(
            'POST /api/v1/admin/content-releases',
            { name: command.title, idempotencyKey: command.idempotencyKey },
            signal,
        );
        message = 'Черновик релиза создан';
    } else if (command.action === 'save') {
        const patches = serializeChanges(command.patch.changes);
        const checksum = await sha256({ name: command.patch.title, patches, clientRevision: command.clientRevision });
        const response = await api.request(
            'PUT /api/v1/admin/content-releases/{id}',
            {
                name: command.patch.title,
                expectedVersion: command.baseVersion,
                patches,
                clientRevision: command.clientRevision,
                checksum,
                idempotencyKey: crypto.randomUUID(),
            },
            signal,
            { id: command.releaseId },
        );
        if (response.data.ack)
            ack = {
                releaseId: command.releaseId,
                baseVersion: response.data.version,
                clientRevision: response.data.ack.clientRevision,
                checksum: response.data.ack.checksum,
            };
        message = 'Черновик сохранён на сервере';
    } else if (command.action === 'validate') {
        await api.request(
            'POST /api/v1/admin/content-releases/{id}/validate',
            { expectedVersion: command.expectedVersion },
            signal,
            { id: command.releaseId },
        );
        message = 'Релиз проверен';
    } else if (command.action === 'publish' || command.action === 'rollback') {
        await api.request(
            command.action === 'publish'
                ? 'POST /api/v1/admin/content-releases/{id}/publish'
                : 'POST /api/v1/admin/content-releases/{id}/rollback',
            { expectedVersion: command.expectedVersion, idempotencyKey: command.idempotencyKey },
            signal,
            { id: command.releaseId },
        );
        message = command.action === 'publish' ? 'Релиз опубликован' : 'Релиз откачен в черновик';
    } else if (command.action === 'reopen') {
        await api.request(
            'POST /api/v1/admin/content-releases/{id}/edit',
            { name: 'Новая редакция', idempotencyKey: crypto.randomUUID() },
            signal,
            { id: command.releaseId },
        );
        message = 'Создана новая редакция';
    } else throw new Error('Публикация каталога вне релиза запрещена');
    return { workspace: await fetchWorkspace(api, signal), ack, message };
}
