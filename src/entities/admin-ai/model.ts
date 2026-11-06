import type { Success } from '../../shared/api/contracts.generated.js';

export type AdminAiControlPlane = Success<'GET /api/v1/admin/ai'>['data'];
