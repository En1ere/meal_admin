import {
    achievementClauseSchema,
    type AchievementCondition,
    type CanonicalPatch,
    type ReleaseChange,
} from './contracts.js';

const groupToCategory = {
    culinary: 'culinary',
    inventory_planning: 'planning',
    author: 'author',
    community_catalog: 'community',
    collections_family: 'collections',
    seasonal_secret: 'seasonal',
} as const;

export function stableUuid(value: string) {
    let a = 0x811c9dc5,
        b = 0x9e3779b9;
    for (const char of value) {
        a = Math.imul(a ^ char.charCodeAt(0), 16777619);
        b = Math.imul(b + char.charCodeAt(0), 2246822519);
    }
    const hex = `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}0000000000000000`;
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function conditionModel(value: Record<string, JsonValue>): AchievementCondition {
    const clause = achievementClauseSchema.safeParse(value);
    if (clause.success) return { kind: 'clause', clause: clause.data };
    if ('all' in value && Array.isArray(value.all)) {
        const clauses = achievementClauseSchema.array().min(1).max(10).safeParse(value.all);
        if (clauses.success) return { kind: 'all', clauses: clauses.data };
    }
    return {
        kind: 'legacy',
        raw: value,
        reason: 'Условие не входит в allowlist aggregate-v1 и требует ручной миграции.',
    };
}

export function conditionPayload(value: AchievementCondition): Record<string, JsonValue> {
    if (value.kind === 'clause') return value.clause;
    if (value.kind === 'all') return { all: value.clauses };
    return value.raw as Record<string, JsonValue>;
}

export function serializeChanges(changes: ReleaseChange[]): CanonicalPatch[] {
    const patches: CanonicalPatch[] = [];
    for (const change of changes) {
        if (change.entityType === 'achievement') {
            if (change.changeType === 'retire')
                patches.push({
                    patchId: stableUuid(`patch-achievement-${change.entityId}`),
                    expectedVersion: change.expectedVersion,
                    resourceType: 'achievement',
                    action: 'retire',
                    resourceKey: change.achievement.code,
                    payload: null,
                });
            else
                patches.push({
                    patchId: stableUuid(`patch-achievement-${change.entityId}`),
                    expectedVersion: change.expectedVersion,
                    resourceType: 'achievement',
                    action: change.changeType === 'add' ? 'create' : 'update',
                    resourceKey: change.achievement.code,
                    payload: {
                        code: change.achievement.code,
                        title: change.achievement.title,
                        description: change.achievement.description,
                        icon: change.achievement.icon,
                        category: groupToCategory[change.achievement.group],
                        condition: conditionPayload(change.achievement.condition),
                        reputationDelta: 0,
                        secret: change.achievement.secret,
                    },
                });
        } else if (change.entityType === 'reputation')
            for (const [index, rank] of change.ranks.entries())
                patches.push({
                    patchId: stableUuid(`patch-rank-${rank.id}`),
                    expectedVersion: rank.version,
                    resourceType: 'reputation_title',
                    action: rank.version ? 'update' : 'create',
                    resourceKey: `level-${index + 1}`,
                    payload: { level: index + 1, threshold: rank.minimum, title: rank.title },
                });
        else if (change.entityType === 'legal_text')
            patches.push({
                patchId: stableUuid(`patch-legal-${change.entityId}`),
                expectedVersion: change.expectedVersion,
                resourceType: 'legal_text',
                action: change.changeType === 'add' ? 'create' : 'update',
                resourceKey: change.label,
                payload: { kind: change.label, content: change.summary, effectiveAt: change.effectiveAt },
            });
        else if (change.entityType === 'product_description')
            patches.push({
                patchId: stableUuid(`patch-product-${change.entityId}`),
                expectedVersion: change.expectedVersion,
                resourceType: 'product_description',
                action: change.changeType === 'add' ? 'create' : 'update',
                resourceKey: change.entityId,
                payload: { productId: change.entityId, description: change.summary },
            });
        else if (change.entityType === 'content_document')
            patches.push({
                patchId: stableUuid(`patch-document-${change.entityId}`),
                expectedVersion: change.expectedVersion,
                resourceType: 'content_document',
                action: change.changeType === 'retire' ? 'retire' : change.changeType === 'add' ? 'create' : 'update',
                resourceKey: change.resourceKey,
                payload: change.changeType === 'retire' ? null : change.document,
            } as CanonicalPatch);
        else
            patches.push({
                patchId: stableUuid(`patch-dictionary-${change.entityId}`),
                expectedVersion: change.expectedVersion,
                resourceType: 'dictionary_entry',
                action: change.changeType === 'retire' ? 'retire' : change.changeType === 'add' ? 'create' : 'update',
                resourceKey: change.resourceKey,
                payload: change.changeType === 'retire' ? null : change.entry,
            } as CanonicalPatch);
    }
    return patches;
}
