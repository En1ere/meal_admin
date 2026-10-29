import { adminReleaseDraftKey } from '../../shared/storage/private-cache.js';
import type { ContentDocument, DictionaryEntry, Release, ReleaseChange } from './contracts.js';

export type ReleaseDraftCache = {
    releaseId: string;
    baseVersion: number;
    clientRevision: number;
    checksum: string;
    patch: { title: string; changes: ReleaseChange[] };
};

export const statusLabel = { draft: 'Черновик', ready: 'Готов к публикации', published: 'Опубликован' } as const;
export const namespaceLabels: Record<ContentDocument['namespace'], string> = {
    help: 'Справка',
    pricing: 'Тарифы',
    onboarding: 'Онбординг',
    notification_template: 'Шаблон уведомления',
    feature_copy: 'Текст функции',
};
export const dictionaryLabels: Record<DictionaryEntry['dictionary'], string> = {
    category: 'Категории',
    unit: 'Единицы измерения',
    allergen: 'Аллергены',
};

export const blankDocument = (namespace: ContentDocument['namespace'], base?: ContentDocument): ContentDocument => {
    const common = {
        locale: base?.locale ?? 'ru-RU',
        title: base?.title ?? 'Новый контентный документ',
        body: base?.body ?? 'Текст документа.',
    };
    if (namespace === 'help')
        return { ...common, namespace, metadata: { schemaVersion: 1, slug: 'new-help', audience: 'all' } };
    if (namespace === 'pricing')
        return { ...common, namespace, metadata: { schemaVersion: 1, plan: 'free', billingPeriod: 'none' } };
    if (namespace === 'onboarding')
        return { ...common, namespace, metadata: { schemaVersion: 1, flow: 'main', step: 1 } };
    if (namespace === 'notification_template')
        return {
            ...common,
            namespace,
            metadata: { schemaVersion: 1, channel: 'in_app', templateKey: 'new-template', variables: [] },
        };
    return {
        ...common,
        namespace,
        metadata: { schemaVersion: 1, featureKey: 'new-feature', placement: 'default' },
    };
};

export const blankDictionaryEntry: DictionaryEntry = {
    schemaVersion: 1,
    dictionary: 'category',
    code: 'new-entry',
    label: 'Новая запись',
    description: null,
    icon: { assetId: null, fallbackKey: 'food-014', alt: 'Иконка записи справочника' },
    sortOrder: 100,
    enabled: true,
};

export const changedFields = (before: object | undefined, after: object) => {
    if (!before) return ['новый ресурс'];
    const previous = before as Record<string, unknown>;
    const next = after as Record<string, unknown>;
    return Object.keys(next).filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key]));
};

export function readReleaseDraftCache(release: Release): ReleaseDraftCache | null {
    try {
        const raw = sessionStorage.getItem(adminReleaseDraftKey);
        if (!raw) return null;
        const value = JSON.parse(raw) as Partial<ReleaseDraftCache>;
        if (
            value.releaseId !== release.id ||
            typeof value.baseVersion !== 'number' ||
            typeof value.clientRevision !== 'number' ||
            typeof value.checksum !== 'string' ||
            !value.patch ||
            typeof value.patch.title !== 'string' ||
            !Array.isArray(value.patch.changes)
        )
            return null;
        return value as ReleaseDraftCache;
    } catch {
        return null;
    }
}
