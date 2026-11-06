import type { AuthContext } from './routes.js';

const sessionRoot = ['session'] as const;

export const authQueryKeys = {
    sessionRoot,
    currentSession: (context: AuthContext) => [...sessionRoot, context] as const,
    sessions: (context: AuthContext) => ['sessions', context] as const,
    adminStatus: ['admin-auth-status'] as const,
};
