import type { AdminObservability } from '../entities/admin-observability/index.js';

const freshness = (observedAt: string) => ({
    state: 'fresh' as const,
    observedAt,
    ageSeconds: 0,
    staleAfterSeconds: 150,
});

export function createObservabilityFixture(now: Date | number): AdminObservability {
    const observedAt = new Date(now).toISOString();
    const workers: AdminObservability['workers'] = [
        'scheduled-news',
        'incident-ignore-expiry',
        'retention-inspection',
        'scheduled-sanctions',
        'diary-portions',
        'email-changes',
        'exports',
        'account-retention',
        'ai-reconciliation',
        'cooking-lifecycle',
    ].map((task) => ({
        task,
        freshness: freshness(observedAt),
        leaseState: 'inactive',
        leaseExpiresAt: null,
        lastOutcome: 'success',
        lastFinishedAt: observedAt,
        lastDurationMs: 240,
        failuresLastHour: 0,
    })) as AdminObservability['workers'];
    const services: AdminObservability['providers']['services'] = [
        'ai',
        'payment',
        'object_storage',
        'key_management',
        'malware_scanner',
        'email',
        'web_push',
        'ocr',
    ].map((service) => ({
        service,
        freshness: freshness(observedAt),
        lastOutcome: 'success',
        lastObservedAt: observedAt,
        sampleCount: 12,
        success: 12,
        providerError: 0,
        timeout: 0,
        cancelled: 0,
        boundaryRejected: 0,
        unavailable: 0,
        averageDurationMs: 180,
    })) as AdminObservability['providers']['services'];
    return {
        schemaVersion: 1,
        generatedAt: observedAt,
        completeness: 'complete',
        host: {
            freshness: freshness(observedAt),
            unavailableReason: null,
            collectorStatus: 'ok',
            durationMs: 72,
            memory: { totalBytes: 8_589_934_592, availableBytes: 5_368_709_120 },
            load1mMilli: 420,
            uptimeSeconds: 864_000,
            rebootRequired: false,
            filesystems: [
                { scope: 'root', totalBytes: 107_374_182_400, availableBytes: 70_000_000_000, usedPercent: 35 },
                { scope: 'deployment', totalBytes: 107_374_182_400, availableBytes: 70_000_000_000, usedPercent: 35 },
                { scope: 'backups', totalBytes: 214_748_364_800, availableBytes: 160_000_000_000, usedPercent: 25 },
            ],
            containers: ['postgres', 'backend', 'worker', 'frontend', 'admin'].map((service) => ({
                service,
                state: 'running',
                health: 'healthy',
                restartCount: 0,
                cpuPermille: 35,
                memoryBytes: 268_435_456,
                memoryLimitBytes: 1_073_741_824,
                pids: 12,
            })) as AdminObservability['host']['containers'],
        },
        database: {
            freshness: freshness(observedAt),
            queryDurationMs: 6,
            schemaVersion: 29,
            databaseSizeBytes: 134_217_728,
            backendPool: { max: 10, total: 2, idle: 2, waiting: 0 },
        },
        queue: {
            freshness: freshness(observedAt),
            counts: {
                pending: 0,
                queued: 0,
                running: 0,
                processing: 0,
                retrying: 0,
                failed: 0,
                deadLetter: 0,
                completed: 42,
                cancelled: 0,
                other: 0,
            },
            dueNow: 0,
            oldestDueAt: null,
        },
        workers,
        providers: { windowSeconds: 3600, services },
    };
}
