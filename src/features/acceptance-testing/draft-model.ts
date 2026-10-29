import type { AcceptanceResult, AcceptanceStatus } from '../../entities/acceptance-test/index.js';

export interface AcceptanceDraft {
    status: AcceptanceStatus;
    comment: string;
}

export interface AcceptanceSaveCommand extends AcceptanceDraft {
    expectedVersion: number;
    idempotencyKey: string;
}

export interface AcceptanceResetCommand {
    expectedVersion: number;
    idempotencyKey: string;
}

export function draftFromResult(result: AcceptanceResult): AcceptanceDraft {
    return { status: result.status, comment: result.comment };
}

export function isAcceptanceDraftDirty(draft: AcceptanceDraft, result: AcceptanceResult) {
    return draft.status !== result.status || draft.comment.trim() !== result.comment;
}

export function acceptanceDraftFingerprint(draft: AcceptanceDraft, version: number) {
    return JSON.stringify([draft.status, draft.comment.trim(), version]);
}

export function createAcceptanceSaveCommand(draft: AcceptanceDraft, version: number): AcceptanceSaveCommand | null {
    if (draft.status === 'not_tested') return null;
    return {
        status: draft.status,
        comment: draft.comment.trim(),
        expectedVersion: version,
        idempotencyKey: crypto.randomUUID(),
    };
}

export function createAcceptanceResetCommand(version: number): AcceptanceResetCommand {
    return { expectedVersion: version, idempotencyKey: crypto.randomUUID() };
}
