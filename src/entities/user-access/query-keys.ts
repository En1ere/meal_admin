import type { Section } from '../admin-section/model.js';

export type GovernanceSection = Extract<Section, 'users' | 'sanctions' | 'access'>;

export const userAccessKeys = {
    root: ['user-access'] as const,
    forSession: (sessionId: string | undefined) => ['user-access', sessionId] as const,
    governance: (sessionId: string | undefined, section: GovernanceSection, id: string) =>
        ['user-access', sessionId, 'governance', section, id] as const,
    freeAi: (sessionId: string | undefined, id: string) => ['user-access', sessionId, 'free-ai', id] as const,
};
