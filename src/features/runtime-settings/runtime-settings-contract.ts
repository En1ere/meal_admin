import { z } from 'zod';
import type { RuntimeSettingsRegistry } from './model.js';

export const runtimeSettingSectionSchema = z.enum([
    'notifications',
    'mail',
    'storage',
    'security',
    'deploy_backup',
    'backup_recovery',
    'integrations',
    'legal',
]);
export const webPushPolicySchema = z.strictObject({
    quietHours: z.strictObject({ start: z.string(), end: z.string() }),
    ttlSeconds: z.strictObject({
        critical: z.number().int(),
        important: z.number().int(),
        informational: z.number().int(),
        marketing: z.number().int(),
    }),
    version: z.number().int().positive(),
});
const entrySchema = z.strictObject({
    key: z.string(),
    label: z.string(),
    description: z.string(),
    value: z.string(),
    status: z.enum(['active', 'disabled', 'partial', 'blocked']),
    source: z.enum(['database', 'environment', 'vps_secret', 'github_secret', 'derived']),
    readiness: z.enum(['ready', 'owner_input', 'external_dependency', 'disabled']),
    editable: z.boolean(),
    sensitive: z.boolean(),
    updatedAt: z.iso.datetime().nullable(),
    version: z.number().int().positive().nullable(),
    blockers: z.array(z.string()),
    affectedServices: z.array(z.string()),
    checks: z.array(z.string()),
    instruction: z.string().nullable(),
    history: z.array(z.strictObject({ at: z.iso.datetime(), actor: z.string(), summary: z.string() })).max(20),
    secret: z
        .strictObject({
            configured: z.boolean(),
            fingerprint: z.string().nullable(),
            rotatedAt: z.iso.datetime().nullable(),
        })
        .nullable(),
    policy: webPushPolicySchema.nullable(),
});
export const runtimeSettingsRegistryEnvelopeSchema = z.strictObject({
    data: z.strictObject({
        tabs: z.array(z.strictObject({ code: runtimeSettingSectionSchema, label: z.string() })),
        selectedTab: runtimeSettingSectionSchema,
        entries: z.array(entrySchema),
        generatedAt: z.iso.datetime(),
        completeness: z.enum(['complete', 'partial']),
        unavailableSources: z.array(z.string()),
    }),
    meta: z.object({ requestId: z.string() }).passthrough(),
});
export const webPushPreviewRequestSchema = webPushPolicySchema
    .omit({ version: true })
    .extend({ expectedVersion: z.number().int().positive() })
    .strict();
export const webPushPreviewEnvelopeSchema = z.strictObject({
    data: z.strictObject({
        previewId: z.uuid(),
        expiresAt: z.iso.datetime(),
        changes: z.array(z.strictObject({ field: z.string(), from: z.string(), to: z.string() })),
        policy: webPushPolicySchema,
    }),
    meta: z.object({ requestId: z.string() }).passthrough(),
});
export const webPushExecuteRequestSchema = webPushPreviewRequestSchema
    .extend({ previewId: z.uuid(), idempotencyKey: z.uuid() })
    .strict();
export const webPushExecuteEnvelopeSchema = z.strictObject({
    data: z.strictObject({ policy: webPushPolicySchema, updatedAt: z.iso.datetime() }),
    meta: z.object({ requestId: z.string() }).passthrough(),
});
const sourceLabels = {
    database: 'База данных',
    environment: 'Environment',
    vps_secret: 'VPS secret',
    github_secret: 'GitHub Secret',
    derived: 'Вычисляемое состояние',
} as const;
export function mapRuntimeSettingsRegistry(
    value: z.infer<typeof runtimeSettingsRegistryEnvelopeSchema>['data'],
): RuntimeSettingsRegistry {
    return {
        generatedAt: value.generatedAt,
        completeness: value.completeness,
        unavailableSources: value.unavailableSources,
        items: value.entries.map((entry) => ({
            id: entry.key,
            section: value.selectedTab,
            title: entry.label,
            description: entry.description,
            displayValue: entry.value,
            status: entry.status === 'active' ? 'ready' : entry.status,
            readiness: entry.readiness,
            source: sourceLabels[entry.source],
            version: entry.version ?? entry.policy?.version ?? 1,
            lastChangedAt: entry.updatedAt,
            affectedServices: entry.affectedServices,
            blockers: entry.blockers,
            checks: entry.checks,
            secret: entry.secret,
            editablePolicy:
                entry.editable && entry.policy
                    ? { quietHours: entry.policy.quietHours, ttlSeconds: entry.policy.ttlSeconds }
                    : null,
            instruction: entry.instruction,
            history: entry.history,
        })),
    };
}
