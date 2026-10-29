import type { AdminObservability, ObservabilityFreshness } from './model.js';

export type ObservabilityIssue = Readonly<{
    key: string;
    message: string;
    href: '/admin/operations' | '/admin/errors';
}>;

export const containerLabels: Record<AdminObservability['host']['containers'][number]['service'], string> = {
    postgres: 'PostgreSQL',
    backend: 'Backend',
    worker: 'Worker',
    frontend: 'Frontend',
    admin: 'Admin',
};

export const workerLabels: Record<AdminObservability['workers'][number]['task'], string> = {
    'scheduled-news': 'Публикация новостей',
    'incident-ignore-expiry': 'Снятие игнорирования инцидентов',
    'retention-inspection': 'Проверка сроков хранения',
    'scheduled-sanctions': 'Запланированные санкции',
    'diary-portions': 'Порции дневника',
    'email-changes': 'Изменения email',
    exports: 'Экспорты',
    'account-retention': 'Хранение аккаунтов',
    'ai-reconciliation': 'Сверка AI',
    'cooking-lifecycle': 'Жизненный цикл готовки',
};

export const providerLabels: Record<AdminObservability['providers']['services'][number]['service'], string> = {
    ai: 'AI',
    payment: 'Платежи',
    object_storage: 'Хранилище объектов',
    key_management: 'Управление ключами',
    malware_scanner: 'Проверка файлов',
    email: 'Email',
    web_push: 'Web Push',
    ocr: 'OCR',
};

export function formatBytes(value: number | null): string {
    if (value === null) return 'Нет данных';
    const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
    let amount = value;
    let unit = 0;
    while (amount >= 1024 && unit < units.length - 1) {
        amount /= 1024;
        unit += 1;
    }
    return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: amount >= 10 ? 1 : 2 }).format(amount)} ${units[unit]}`;
}

export function formatDuration(value: number | null): string {
    if (value === null) return 'Нет данных';
    if (value < 1000) return `${value} мс`;
    return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value / 1000)} с`;
}

export function formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleString('ru-RU') : 'Нет данных';
}

export function freshnessText(value: ObservabilityFreshness): string {
    if (value.state === 'no_samples') return 'Наблюдений пока нет';
    if (value.state === 'unavailable') return 'Источник недоступен';
    if (value.state === 'stale') return `Данные устарели${value.ageSeconds === null ? '' : ` (${value.ageSeconds} с)`}`;
    return 'Актуальные данные';
}

export function collectObservabilityIssues(data: AdminObservability): ObservabilityIssue[] {
    const issues: ObservabilityIssue[] = [];
    const push = (key: string, message: string, href: ObservabilityIssue['href']) =>
        issues.push({ key, message, href });
    if (data.completeness === 'partial') push('partial', 'Снимок собран не полностью.', '/admin/errors');
    if (data.host.freshness.state === 'stale') push('host-stale', 'Данные хоста устарели.', '/admin/errors');
    if (data.host.freshness.state === 'unavailable')
        push('host-unavailable', 'Данные хоста недоступны.', '/admin/errors');
    if (data.host.collectorStatus === 'partial')
        push('collector', 'Коллектор хоста вернул частичные данные.', '/admin/errors');
    if (data.host.rebootRequired) push('reboot', 'Хост ожидает перезагрузки.', '/admin/errors');
    if (data.database.freshness.state === 'stale') push('database-stale', 'Данные БД устарели.', '/admin/errors');
    if (data.database.freshness.state === 'unavailable')
        push('database-unavailable', 'Данные БД недоступны.', '/admin/errors');
    if (data.queue.freshness.state === 'stale') push('queue-stale', 'Данные очереди устарели.', '/admin/operations');
    if (data.queue.freshness.state === 'unavailable')
        push('queue-unavailable', 'Данные очереди недоступны.', '/admin/operations');
    for (const item of data.host.containers) {
        if (item.state !== 'running')
            push(`container-${item.service}`, `${containerLabels[item.service]}: ${item.state}.`, '/admin/errors');
        else if (item.health === 'unhealthy')
            push(
                `health-${item.service}`,
                `${containerLabels[item.service]}: проверка здоровья не пройдена.`,
                '/admin/errors',
            );
    }
    if ((data.database.backendPool?.waiting ?? 0) > 0)
        push('db-waiting', `Подключения к БД ожидают: ${data.database.backendPool!.waiting}.`, '/admin/errors');
    const counts = data.queue.counts;
    if ((counts?.failed ?? 0) > 0) push('queue-failed', `Ошибок в очереди: ${counts!.failed}.`, '/admin/operations');
    if ((counts?.deadLetter ?? 0) > 0) push('queue-dead', `В dead letter: ${counts!.deadLetter}.`, '/admin/operations');
    if ((data.queue.dueNow ?? 0) > 0) push('queue-due', `Просрочено задач: ${data.queue.dueNow}.`, '/admin/operations');
    for (const worker of data.workers) {
        if (
            worker.failuresLastHour > 0 ||
            ['failure', 'timeout', 'partial', 'skipped_not_ready'].includes(worker.lastOutcome ?? '')
        )
            push(`worker-${worker.task}`, `${workerLabels[worker.task]} требует проверки.`, '/admin/operations');
    }
    for (const provider of data.providers.services) {
        if (provider.freshness.state === 'stale')
            push(
                `provider-${provider.service}-stale`,
                `${providerLabels[provider.service]}: данные устарели.`,
                '/admin/errors',
            );
        if (provider.freshness.state === 'unavailable')
            push(
                `provider-${provider.service}-unavailable`,
                `${providerLabels[provider.service]}: данные недоступны.`,
                '/admin/errors',
            );
        if (provider.providerError + provider.timeout + provider.unavailable + provider.boundaryRejected > 0)
            push(
                `provider-${provider.service}`,
                `${providerLabels[provider.service]}: за последний час есть ошибки.`,
                '/admin/errors',
            );
    }
    return issues;
}
