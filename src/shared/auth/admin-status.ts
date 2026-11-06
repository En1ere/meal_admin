import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../api/client.js';
import { useRuntime } from '../runtime/index.js';
import { authQueryKeys } from './query-keys.js';

export const adminAuthStatusKey = authQueryKeys.adminStatus;

export function useAdminStatus() {
    const { api } = useRuntime();
    return useQuery({
        queryKey: adminAuthStatusKey,
        enabled: !!api,
        queryFn: async ({ signal }) => {
            if (!api) throw new Error('API not ready');
            try {
                return (await api.request('GET /api/v1/admin/auth/status', undefined, signal)).data;
            } catch (error) {
                if (error instanceof ApiError && error.status === 401) return null;
                throw error;
            }
        },
    });
}
