import type { Section } from '../admin-section/model.js';

export type BillingSection = Extract<Section, 'users' | 'subscriptions' | 'payments'>;

export const billingAccountKeys = {
    root: ['billing-account'] as const,
    forSession: (sessionId: string | undefined) => ['billing-account', sessionId] as const,
    workspace: (sessionId: string | undefined, section: BillingSection, id: string) =>
        ['billing-account', sessionId, section, id] as const,
};
