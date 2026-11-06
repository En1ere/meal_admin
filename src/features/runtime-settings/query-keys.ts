import type { RuntimeSettingSection } from './model.js';

export const runtimeSettingsKeys = {
    root: ['runtime-settings'] as const,
    registry: (principalId: string | undefined, section: RuntimeSettingSection) =>
        ['runtime-settings', principalId, section] as const,
};
