import type { Success } from '../../shared/api/contracts.generated.js';

export type AdminObservability = Success<'GET /api/v1/admin/observability'>['data'];
export type ObservabilityFreshness = AdminObservability['host']['freshness'];
export type ObservabilityContainer = AdminObservability['host']['containers'][number];
export type ObservabilityWorker = AdminObservability['workers'][number];
export type ObservabilityProvider = AdminObservability['providers']['services'][number];
