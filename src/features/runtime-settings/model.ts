export const runtimeSettingSections = [
    ['notifications', 'Уведомления'],
    ['mail', 'Почта'],
    ['storage', 'Хранилище и OCR'],
    ['security', 'Безопасность'],
    ['deploy_backup', 'Деплой и backup'],
    ['integrations', 'Интеграции'],
    ['legal', 'Юридические данные'],
] as const;

export type RuntimeSettingSection = (typeof runtimeSettingSections)[number][0];
export type RuntimeSettingStatus = 'ready' | 'partial' | 'blocked' | 'disabled' | 'unknown';
export type RuntimeSettingReadiness = 'ready' | 'owner_input' | 'external_dependency' | 'disabled';

export type WebPushPolicy = Readonly<{
    quietHours: Readonly<{ start: string; end: string }>;
    ttlSeconds: Readonly<{
        critical: number;
        important: number;
        informational: number;
        marketing: number;
    }>;
}>;

export type RuntimeSetting = Readonly<{
    id: string;
    section: RuntimeSettingSection;
    title: string;
    description: string;
    displayValue: string;
    status: RuntimeSettingStatus;
    readiness: RuntimeSettingReadiness;
    source: string;
    version: number;
    lastChangedAt: string | null;
    affectedServices: readonly string[];
    blockers: readonly string[];
    checks: readonly string[];
    secret: Readonly<{
        configured: boolean;
        fingerprint: string | null;
        rotatedAt: string | null;
    }> | null;
    editablePolicy: WebPushPolicy | null;
    instruction: string | null;
    history: readonly Readonly<{ at: string; actor: string; summary: string }>[];
}>;

export type RuntimeSettingsRegistry = Readonly<{
    generatedAt: string;
    completeness: 'complete' | 'partial';
    unavailableSources: readonly string[];
    items: readonly RuntimeSetting[];
}>;

export const runtimeStatusLabels: Record<RuntimeSettingStatus, string> = {
    ready: 'Готово',
    partial: 'Частично',
    blocked: 'Заблокировано',
    disabled: 'Выключено',
    unknown: 'Нет данных',
};

export const runtimeReadinessLabels: Record<RuntimeSettingReadiness, string> = {
    ready: 'Готово к работе',
    owner_input: 'Нужны данные владельца',
    external_dependency: 'Зависит от внешнего сервиса',
    disabled: 'Не используется',
};
