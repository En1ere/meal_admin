export const adminAiKeys = {
    snapshot: (sessionId: string) => ['admin-ai', sessionId, 'snapshot'] as const,
};
