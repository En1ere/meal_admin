export type OperationWorkspaceSection = 'operations' | 'errors';

export const operationKeys = {
    root: ['operations-workspace'] as const,
    workspace: (principalId: string | undefined, section: OperationWorkspaceSection, id: string, itemVersion: string) =>
        ['operations-workspace', principalId, section, id, itemVersion] as const,
};
