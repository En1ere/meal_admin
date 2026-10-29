export const supportTicketKeys = {
    root: ['support-ticket'] as const,
    forSession: (sessionId: string | undefined) => ['support-ticket', sessionId] as const,
    ticket: (sessionId: string | undefined, id: string) => ['support-ticket', sessionId, 'ticket', id] as const,
    workspace: (sessionId: string | undefined, id: string) =>
        ['support-ticket', sessionId, 'ticket', id, 'workspace'] as const,
    messages: (sessionId: string | undefined, id: string) =>
        ['support-ticket', sessionId, 'ticket', id, 'messages'] as const,
};
