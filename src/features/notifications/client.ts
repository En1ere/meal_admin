export async function loadNotificationCenterPage() {
    return (await import('./notification-center.js')).NotificationCenterPage;
}

export async function loadNotificationSettingsPage() {
    return (await import('./notification-settings.js')).NotificationSettingsPage;
}
