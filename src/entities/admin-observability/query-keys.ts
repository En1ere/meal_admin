export const adminObservabilityKeys = {
    root: ['admin-observability'] as const,
    snapshot: (sessionId: string) => ['admin-observability', sessionId, 'snapshot'] as const,
};
