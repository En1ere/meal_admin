import type { ContentSection } from './contracts.js';

export const contentWorkflowKeys = {
    root: ['content-workflow'] as const,
    forSession: (sessionId: string | undefined) => ['content-workflow', sessionId] as const,
    workspace: (sessionId: string | undefined, section: ContentSection, id: string) =>
        ['content-workflow', sessionId, section, id] as const,
};
