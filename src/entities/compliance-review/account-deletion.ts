const reviewableAccountDeletionStatuses = new Set(['requested', 'retention_wait', 'blocked']);

export function isAccountDeletionReviewable(status: string | null | undefined): boolean {
    return status != null && reviewableAccountDeletionStatuses.has(status);
}
