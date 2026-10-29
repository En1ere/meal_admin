export const acceptanceTestKeys = {
    root: ['admin-acceptance-tests'] as const,
    workspace: (sessionId: string) => ['admin-acceptance-tests', sessionId, 'workspace'] as const,
};
