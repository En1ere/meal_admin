import type { Success } from '../../shared/api/contracts.generated.js';

export type AdminRecord = Success<'GET /api/v1/admin/{section}/{id}'>['data']['item'];
