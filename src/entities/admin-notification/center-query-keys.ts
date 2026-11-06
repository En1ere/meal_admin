export const adminNotificationCenterKeys = {
    root: ['notification-center'] as const,
    forPrincipal: (principalId: string | undefined) => ['notification-center', principalId] as const,
};
