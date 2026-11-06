import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type AdminRecordSection =
    (typeof contracts)['POST /api/v1/admin/{section}/search']['params']['_output']['section'];

export type AdminRecord = Success<'GET /api/v1/admin/{section}/{id}'>['data']['item'];
