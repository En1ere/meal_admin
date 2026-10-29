import {
    AdminRecordPage as AdminRecordFeaturePage,
    type AdminRecordDetailContext,
    type AdminRecordPageExtensions,
} from '../../features/admin-record/client.js';
import { SupportConversation, SupportCreate } from '../../features/support/client.js';
import { BillingWorkspace } from '../../features/billing/client.js';
import { ContentPanel } from '../../features/content/client.js';
import { FreeAiWorkspace, GovernanceActions } from '../../features/user-governance/client.js';
import { OperationsWorkspace } from '../../features/operations/client.js';
import { AccountDeletionReview, ReviewPanel } from '../../features/review/client.js';
import type { Section } from '../../entities/admin-section/model.js';

const sectionsWithCustomActions = new Set<Section>([
    'users',
    'access',
    'sanctions',
    'operations',
    'errors',
    'support',
    'queues',
    'catalog',
    'subscriptions',
    'payments',
    'legal-requests',
    'rollback',
]);

function renderDetailActions({ section, id, item, requestKind }: AdminRecordDetailContext) {
    return (
        <>
            {(['users', 'access', 'sanctions'] as Section[]).includes(section) && (
                <GovernanceActions section={section as 'users' | 'access' | 'sanctions'} id={id} />
            )}
            {(section === 'operations' || section === 'errors') && (
                <OperationsWorkspace section={section} id={id} itemVersion={item.version} />
            )}
            {(section === 'queues' || section === 'catalog') && (
                <ContentPanel key={`${section}:${id}`} section={section} id={id} />
            )}
            {section === 'users' && <FreeAiWorkspace id={id} />}
            {(section === 'users' || section === 'subscriptions' || section === 'payments') && (
                <BillingWorkspace section={section} id={id} />
            )}
            {(section === 'rollback' ||
                (section === 'legal-requests' && !['account_deletion', 'deletion'].includes(requestKind ?? ''))) && (
                <ReviewPanel section={section} id={id} />
            )}
            {section === 'legal-requests' && ['account_deletion', 'deletion'].includes(requestKind ?? '') && (
                <AccountDeletionReview key={id} id={id} version={Number(item.version)} status={item.status} />
            )}
        </>
    );
}

const extensions: AdminRecordPageExtensions = {
    renderListPrelude: (section) => (section === 'support' ? <SupportCreate /> : null),
    renderBeforeCollections: ({ section, id, item }) =>
        section === 'support' ? <SupportConversation id={id} version={item.version} status={item.status} /> : null,
    renderDetailActions,
    hasCustomActions: (section) => sectionsWithCustomActions.has(section),
};

export function AdminRecordPage({ fixedSection }: { fixedSection?: Section | undefined }) {
    return <AdminRecordFeaturePage fixedSection={fixedSection} extensions={extensions} />;
}
