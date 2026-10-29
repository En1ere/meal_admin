import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../shared/runtime/index.js';
import { ApiError } from '../../shared/api/client.js';
import type { AuthContext } from '../../shared/auth/routes.js';
import { staffSessionKeys } from './model.js';

export function useStaffSession(context: AuthContext) {
    const { api } = useRuntime();
    return useQuery({
        queryKey: staffSessionKeys.current(context),
        enabled: !!api,
        refetchInterval: 30000,
        queryFn: async ({ signal }) => {
            if (!api) throw new Error('API not ready');
            try {
                return (await api.request('GET /api/v1/admin/auth/me', undefined, signal)).data.user;
            } catch (error) {
                if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
                throw error;
            }
        },
    });
}
