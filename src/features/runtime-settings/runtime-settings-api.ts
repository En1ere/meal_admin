import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRuntime } from '../../shared/runtime/index.js';
import { useStaffSession } from '../../entities/staff-session/client.js';
import type { RuntimeSettingSection, WebPushPolicy } from './model.js';
import { runtimeSettingsKeys } from './query-keys.js';
import {
    mapRuntimeSettingsRegistry,
    runtimeSettingsRegistryEnvelopeSchema,
    webPushExecuteEnvelopeSchema,
    webPushExecuteRequestSchema,
    webPushPreviewEnvelopeSchema,
    webPushPreviewRequestSchema,
} from './runtime-settings-contract.js';

export function useRuntimeSettings(section: RuntimeSettingSection) {
    const { api } = useRuntime();
    const session = useStaffSession('admin');
    return useQuery({
        queryKey: runtimeSettingsKeys.registry(session.data?.id, section),
        enabled: !!api && !!session.data,
        queryFn: async ({ signal }) => {
            const result = await api!.request('GET /api/v1/admin/runtime-settings', undefined, signal, undefined, {
                query: { tab: section },
            });
            return mapRuntimeSettingsRegistry(runtimeSettingsRegistryEnvelopeSchema.parse(result).data);
        },
    });
}

export function usePreviewWebPushPolicy() {
    const { api } = useRuntime();
    return useMutation({
        mutationFn: async (input: { expectedVersion: number; policy: WebPushPolicy }) => {
            const body = { ...input.policy, expectedVersion: input.expectedVersion };
            const result = await api!.request(
                'POST /api/v1/admin/runtime-settings/web-push-policy/preview',
                webPushPreviewRequestSchema.parse(body),
            );
            return webPushPreviewEnvelopeSchema.parse(result).data;
        },
    });
}

export function useExecuteWebPushPolicy() {
    const { api } = useRuntime();
    const cache = useQueryClient();
    return useMutation({
        mutationFn: async (input: { expectedVersion: number; policy: WebPushPolicy; previewId: string }) => {
            const body = {
                ...input.policy,
                expectedVersion: input.expectedVersion,
                previewId: input.previewId,
                idempotencyKey: crypto.randomUUID(),
            };
            const result = await api!.request(
                'POST /api/v1/admin/runtime-settings/web-push-policy/execute',
                webPushExecuteRequestSchema.parse(body),
            );
            return webPushExecuteEnvelopeSchema.parse(result).data;
        },
        onSuccess: async () => cache.invalidateQueries({ queryKey: runtimeSettingsKeys.root }),
    });
}
