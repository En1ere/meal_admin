export type ComplianceReviewSection = 'legal-requests' | 'rollback';

export const complianceReviewKeys = {
    root: ['compliance-review'] as const,
    forSession: (sessionId: string | undefined) => ['compliance-review', sessionId] as const,
    workspace: (sessionId: string | undefined, section: ComplianceReviewSection, id: string) =>
        ['compliance-review', sessionId, section, id] as const,
};
