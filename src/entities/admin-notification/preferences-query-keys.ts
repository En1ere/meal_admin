export const adminNotificationPreferencesKeys = {
    root: ['notification-settings'] as const,
    forPrincipal: (principalId: string | undefined) => ['notification-settings', principalId] as const,
};
