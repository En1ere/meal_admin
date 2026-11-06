export type BillingSection = 'users' | 'subscriptions' | 'payments';

export const billingAccountKeys = {
    root: ['billing-account'] as const,
    forSession: (sessionId: string | undefined) => ['billing-account', sessionId] as const,
    workspace: (sessionId: string | undefined, section: BillingSection, id: string) =>
        ['billing-account', sessionId, section, id] as const,
};
