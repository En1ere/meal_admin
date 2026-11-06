import { adminNotificationCenterKeys } from './center-query-keys.js';
import { adminNotificationPreferencesKeys } from './preferences-query-keys.js';

export const adminNotificationKeys = {
    preferencesRoot: adminNotificationPreferencesKeys.root,
    preferences: adminNotificationPreferencesKeys.forPrincipal,
    centerRoot: adminNotificationCenterKeys.root,
    center: adminNotificationCenterKeys.forPrincipal,
};
