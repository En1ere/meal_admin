import type { Section } from '../admin-section/model.js';

export const adminRecordKeys = {
    root: ['admin-record'] as const,
    forSession: (sessionId: string | undefined) => ['admin-record', sessionId] as const,
    lists: (sessionId: string | undefined) => ['admin-record', sessionId, 'list'] as const,
    list: (sessionId: string | undefined, section: Section, filters: object | null) =>
        ['admin-record', sessionId, 'list', section, filters] as const,
    filters: (sessionId: string | undefined, section: Section) =>
        ['admin-record', sessionId, 'filters', section] as const,
    details: (sessionId: string | undefined) => ['admin-record', sessionId, 'detail'] as const,
    detail: (sessionId: string | undefined, section: Section, id: string) =>
        ['admin-record', sessionId, 'detail', section, id] as const,
    relatedRoot: (sessionId: string | undefined) => ['admin-record', sessionId, 'related'] as const,
    related: (sessionId: string | undefined, section: Section, id: string, collection?: string) =>
        collection === undefined
            ? (['admin-record', sessionId, 'related', section, id] as const)
            : (['admin-record', sessionId, 'related', section, id, collection] as const),
};
