import type { Success } from '../../shared/api/contracts.generated.js';

export type AcceptanceWorkspace = Success<'GET /api/v1/admin/acceptance-tests'>['data'];
export type AcceptanceGroup = AcceptanceWorkspace['groups'][number];
export type AcceptanceCase = AcceptanceGroup['cases'][number];
export type AcceptanceResult = AcceptanceCase['result'];
export type AcceptanceStatus = AcceptanceResult['status'];
export type AcceptanceSummary = AcceptanceWorkspace['summary'];
