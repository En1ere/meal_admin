import type { AuthContext } from '../../shared/auth/routes.js';

export const staffSessionKeys = {
    root: ['session'] as const,
    current: (context: AuthContext) => ['session', context] as const,
};
