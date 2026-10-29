import { useQuery } from '@tanstack/react-query';
import { AppIcon, Skeleton } from '@meal-planner/design-system';
import { Link } from 'react-router-dom';
import { ApiError } from '../../shared/api/client.js';
import { useRuntime } from '../../shared/runtime/index.js';
import { useStaffSession } from '../../entities/staff-session/client.js';
import {
    adminObservabilityKeys,
    collectObservabilityIssues,
    containerLabels,
    formatBytes,
    formatDate,
    formatDuration,
    freshnessText,
    providerLabels,
    workerLabels,
    type AdminObservability,
} from '../../entities/admin-observability/index.js';
import styles from './observability.module.css';

const unavailableReasons = {
    disabled: 'Сбор метрик отключён.',
    missing: 'Файл снимка не найден.',
    unreadable: 'Снимок недоступен для чтения.',
    invalid: 'Снимок не прошёл проверку.',
    clock_skew: 'Время снимка не согласовано с сервером.',
} as const;

const stateLabels: Record<string, string> = {
    running: 'Работает',
    exited: 'Остановлен',
    restarting: 'Перезапускается',
    paused: 'Приостановлен',
    created: 'Создан',
    missing: 'Не найден',
    unknown: 'Неизвестно',
    healthy: 'Исправен',
    unhealthy: 'Неисправен',
    starting: 'Запускается',
    none: 'Без healthcheck',
    success: 'Успешно',
    partial: 'Частично',
    skipped_overlap: 'Пропущен: предыдущий запуск активен',
    skipped_not_ready: 'Пропущен: система не готова',
    timeout: 'Тайм-аут',
    failure: 'Ошибка',
    provider_error: 'Ошибка провайдера',
    cancelled: 'Отменено',
    boundary_rejected: 'Отклонено защитным контуром',
    unavailable: 'Недоступно',
    active: 'Активна',
    inactive: 'Не активна',
    no_record: 'Записи нет',
};

function Status({ tone, children }: { tone: 'ok' | 'warning' | 'muted'; children: React.ReactNode }) {
    return (
        <span className={`${styles.status} ${styles[tone]}`}>
            <span aria-hidden="true">●</span>
            {children}
        </span>
    );
}

function Metric({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
    return (
        <div className={styles.metric}>
            <span>{label}</span>
            <strong>{value}</strong>
            {note && <small>{note}</small>}
        </div>
    );
}

function hostUnavailableText(data: AdminObservability) {
    const reason = data.host.unavailableReason;
    return reason ? unavailableReasons[reason] : 'Источник не передал данные хоста.';
}

function ObservabilityContent({ data }: { data: AdminObservability }) {
    const issues = collectObservabilityIssues(data);
    const healthy = issues.length === 0;
    const memoryUsed = data.host.memory
        ? Math.max(0, data.host.memory.totalBytes - data.host.memory.availableBytes)
        : null;
    const queue = data.queue.counts;
    return (
        <>
            <section
                className={`${styles.hero} ${healthy ? styles.heroOk : styles.heroWarning}`}
                aria-labelledby="observability-summary"
            >
                <AppIcon name={healthy ? 'home' : 'notifications'} aria-hidden="true" />
                <div>
                    <h2 id="observability-summary">
                        {healthy ? 'Система работает штатно' : 'Система требует внимания'}
                    </h2>
                    <p>
                        {healthy
                            ? 'Явных проблем в текущем снимке не обнаружено.'
                            : `Обнаружено сигналов: ${issues.length}. Проверьте детали ниже.`}
                    </p>
                    <p className={styles.freshness}>
                        Снимок: <time dateTime={data.generatedAt}>{formatDate(data.generatedAt)}</time> ·{' '}
                        {data.completeness === 'complete' ? 'полный' : 'частичный'}
                    </p>
                </div>
            </section>

            {issues.length > 0 && (
                <aside className={styles.warningStrip} aria-label="Сигналы, требующие внимания">
                    <AppIcon name="notifications" aria-hidden="true" />
                    <div>
                        <strong>
                            {issues.length} {issues.length === 1 ? 'сигнал требует' : 'сигналов требуют'} внимания
                        </strong>
                        <p>{issues[0]!.message}</p>
                    </div>
                    <Link to={issues[0]!.href}>Перейти к разделу</Link>
                </aside>
            )}

            <div className={styles.surface}>
                <section className={styles.row} aria-labelledby="observability-host">
                    <div className={styles.rowHeading}>
                        <AppIcon name="settings" aria-hidden="true" />
                        <div>
                            <h2 id="observability-host">Хост и диски</h2>
                            <Status tone={data.host.freshness.state === 'fresh' ? 'ok' : 'warning'}>
                                {freshnessText(data.host.freshness)}
                            </Status>
                        </div>
                    </div>
                    {data.host.freshness.state === 'unavailable' ? (
                        <p className={styles.unavailable}>{hostUnavailableText(data)}</p>
                    ) : (
                        <div className={styles.metrics}>
                            <Metric
                                label="Память"
                                value={
                                    data.host.memory
                                        ? `${formatBytes(memoryUsed)} / ${formatBytes(data.host.memory.totalBytes)}`
                                        : 'Нет данных'
                                }
                                note="использовано / всего"
                            />
                            <Metric
                                label="Нагрузка за 1 мин"
                                value={
                                    data.host.load1mMilli === null
                                        ? 'Нет данных'
                                        : (data.host.load1mMilli / 1000).toLocaleString('ru-RU')
                                }
                            />
                            <Metric
                                label="Перезагрузка"
                                value={
                                    data.host.rebootRequired === null
                                        ? 'Нет данных'
                                        : data.host.rebootRequired
                                          ? 'Требуется'
                                          : 'Не требуется'
                                }
                            />
                            <Metric
                                label="Коллектор"
                                value={
                                    data.host.collectorStatus === null
                                        ? 'Нет данных'
                                        : data.host.collectorStatus === 'ok'
                                          ? 'Исправен'
                                          : 'Частичные данные'
                                }
                                note={formatDuration(data.host.durationMs)}
                            />
                            {data.host.filesystems.map((disk) => (
                                <Metric
                                    key={disk.scope}
                                    label={
                                        { root: 'Корневой диск', deployment: 'Деплой', backups: 'Резервные копии' }[
                                            disk.scope
                                        ]
                                    }
                                    value={disk.usedPercent === null ? 'Нет данных' : `${disk.usedPercent}%`}
                                    note={
                                        disk.availableBytes === null
                                            ? undefined
                                            : `свободно ${formatBytes(disk.availableBytes)}`
                                    }
                                />
                            ))}
                        </div>
                    )}
                </section>

                <section className={styles.row} aria-labelledby="observability-services">
                    <div className={styles.rowHeading}>
                        <AppIcon name="inventory" aria-hidden="true" />
                        <div>
                            <h2 id="observability-services">Сервисы</h2>
                            <Status
                                tone={
                                    data.host.containers.every(
                                        (item) => item.state === 'running' && item.health !== 'unhealthy',
                                    )
                                        ? 'ok'
                                        : 'warning'
                                }
                            >
                                {data.host.containers.length ? 'Контейнеры' : 'Нет данных'}
                            </Status>
                        </div>
                    </div>
                    <div className={styles.cards}>
                        {data.host.containers.length ? (
                            data.host.containers.map((item) => (
                                <article key={item.service} className={styles.card}>
                                    <strong>{containerLabels[item.service]}</strong>
                                    <Status
                                        tone={
                                            item.state === 'running' && item.health !== 'unhealthy' ? 'ok' : 'warning'
                                        }
                                    >
                                        {stateLabels[item.state]}
                                    </Status>
                                    <small>
                                        Health: {stateLabels[item.health]} · рестарты:{' '}
                                        {item.restartCount ?? 'Нет данных'}
                                    </small>
                                    <small>
                                        CPU:{' '}
                                        {item.cpuPermille === null
                                            ? 'Нет данных'
                                            : `${(item.cpuPermille / 10).toLocaleString('ru-RU')}%`}{' '}
                                        · RAM: {formatBytes(item.memoryBytes)}
                                    </small>
                                </article>
                            ))
                        ) : (
                            <p className={styles.unavailable}>{hostUnavailableText(data)}</p>
                        )}
                    </div>
                </section>

                <section className={styles.row} aria-labelledby="observability-database">
                    <div className={styles.rowHeading}>
                        <AppIcon name="inventory" aria-hidden="true" />
                        <div>
                            <h2 id="observability-database">База данных</h2>
                            <Status tone={data.database.freshness.state === 'fresh' ? 'ok' : 'warning'}>
                                {freshnessText(data.database.freshness)}
                            </Status>
                        </div>
                    </div>
                    <div className={styles.metrics}>
                        <Metric label="Схема" value={data.database.schemaVersion ?? 'Нет данных'} />
                        <Metric label="Размер" value={formatBytes(data.database.databaseSizeBytes)} />
                        <Metric label="Время запроса" value={formatDuration(data.database.queryDurationMs)} />
                        <Metric
                            label="Пул"
                            value={
                                data.database.backendPool
                                    ? `${data.database.backendPool.total} / ${data.database.backendPool.max}`
                                    : 'Нет данных'
                            }
                            note="соединений / максимум"
                        />
                        <Metric label="Ожидают" value={data.database.backendPool?.waiting ?? 'Нет данных'} />
                    </div>
                </section>

                <section className={styles.row} aria-labelledby="observability-queue">
                    <div className={styles.rowHeading}>
                        <AppIcon name="plan" aria-hidden="true" />
                        <div>
                            <h2 id="observability-queue">Очередь</h2>
                            <Status
                                tone={
                                    (queue?.failed ?? 0) + (queue?.deadLetter ?? 0) + (data.queue.dueNow ?? 0) === 0
                                        ? 'ok'
                                        : 'warning'
                                }
                            >
                                {freshnessText(data.queue.freshness)}
                            </Status>
                        </div>
                    </div>
                    <div className={styles.metrics}>
                        <Metric
                            label="Ожидают"
                            value={queue ? queue.pending + queue.queued + queue.retrying : 'Нет данных'}
                        />
                        <Metric label="Выполняются" value={queue ? queue.running + queue.processing : 'Нет данных'} />
                        <Metric
                            label="Просрочены"
                            value={data.queue.dueNow ?? 'Нет данных'}
                            note={
                                data.queue.oldestDueAt
                                    ? `самая ранняя: ${formatDate(data.queue.oldestDueAt)}`
                                    : undefined
                            }
                        />
                        <Metric
                            label="Ошибки / dead letter"
                            value={queue ? `${queue.failed} / ${queue.deadLetter}` : 'Нет данных'}
                        />
                    </div>
                </section>

                <section className={styles.row} aria-labelledby="observability-workers">
                    <div className={styles.rowHeading}>
                        <AppIcon name="settings" aria-hidden="true" />
                        <div>
                            <h2 id="observability-workers">Воркеры</h2>
                            <Status
                                tone={
                                    data.workers.some(
                                        (worker) =>
                                            worker.failuresLastHour > 0 ||
                                            ['failure', 'timeout', 'partial', 'skipped_not_ready'].includes(
                                                worker.lastOutcome ?? '',
                                            ),
                                    )
                                        ? 'warning'
                                        : 'ok'
                                }
                            >
                                {data.workers.length} фоновых задач
                            </Status>
                        </div>
                    </div>
                    <div className={styles.detailList}>
                        {data.workers.map((worker) => {
                            const warning =
                                worker.failuresLastHour > 0 ||
                                ['failure', 'timeout', 'partial', 'skipped_not_ready'].includes(
                                    worker.lastOutcome ?? '',
                                );
                            return (
                                <article key={worker.task} className={styles.detailItem}>
                                    <div>
                                        <strong>{workerLabels[worker.task]}</strong>
                                        <Status
                                            tone={
                                                worker.freshness.state === 'no_samples'
                                                    ? 'muted'
                                                    : warning
                                                      ? 'warning'
                                                      : 'ok'
                                            }
                                        >
                                            {worker.freshness.state === 'no_samples'
                                                ? 'Наблюдений пока нет'
                                                : worker.lastOutcome
                                                  ? stateLabels[worker.lastOutcome]
                                                  : 'Нет данных'}
                                        </Status>
                                    </div>
                                    <small>
                                        Ошибок за час: {worker.failuresLastHour} · lease:{' '}
                                        {stateLabels[worker.leaseState]} · длительность:{' '}
                                        {formatDuration(worker.lastDurationMs)}
                                    </small>
                                </article>
                            );
                        })}
                    </div>
                </section>

                <section className={styles.row} aria-labelledby="observability-providers">
                    <div className={styles.rowHeading}>
                        <AppIcon name="ai" aria-hidden="true" />
                        <div>
                            <h2 id="observability-providers">Провайдеры</h2>
                            <Status
                                tone={
                                    data.providers.services.some(
                                        (item) =>
                                            item.providerError +
                                                item.timeout +
                                                item.unavailable +
                                                item.boundaryRejected >
                                            0,
                                    )
                                        ? 'warning'
                                        : 'ok'
                                }
                            >
                                Окно: {data.providers.windowSeconds / 60} мин
                            </Status>
                        </div>
                    </div>
                    <div className={styles.cards}>
                        {data.providers.services.map((provider) => {
                            const warning =
                                provider.providerError +
                                    provider.timeout +
                                    provider.unavailable +
                                    provider.boundaryRejected >
                                0;
                            return (
                                <article key={provider.service} className={styles.card}>
                                    <strong>{providerLabels[provider.service]}</strong>
                                    <Status
                                        tone={
                                            provider.freshness.state === 'no_samples'
                                                ? 'muted'
                                                : warning
                                                  ? 'warning'
                                                  : 'ok'
                                        }
                                    >
                                        {provider.freshness.state === 'no_samples'
                                            ? 'Наблюдений пока нет'
                                            : provider.lastOutcome
                                              ? stateLabels[provider.lastOutcome]
                                              : 'Нет данных'}
                                    </Status>
                                    <small>
                                        Успешно: {provider.success} из {provider.sampleCount} · среднее:{' '}
                                        {formatDuration(provider.averageDurationMs)}
                                    </small>
                                    <small>
                                        Ошибки: {provider.providerError}, тайм-ауты: {provider.timeout}, недоступно:{' '}
                                        {provider.unavailable}
                                    </small>
                                </article>
                            );
                        })}
                    </div>
                </section>
            </div>
        </>
    );
}

function errorMessage(error: Error) {
    if (error instanceof ApiError) {
        if (error.status === 403) return 'У вашей учётной записи нет доступа к состоянию системы.';
        if (error.status === 429) return 'Слишком частое обновление. Подождите и повторите запрос вручную.';
    }
    return 'Не удалось получить состояние системы. Проверьте подключение и повторите запрос.';
}

export function ObservabilityPage() {
    const { api } = useRuntime();
    const session = useStaffSession('admin');
    const sessionId = session.data?.id;
    const query = useQuery({
        queryKey: adminObservabilityKeys.snapshot(sessionId ?? 'pending'),
        enabled: !!api && !!sessionId,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        queryFn: async ({ signal }) => {
            if (!api) throw new Error('API not ready');
            return (await api.request('GET /api/v1/admin/observability', undefined, signal)).data;
        },
    });
    return (
        <main id="main" className={styles.page} aria-busy={query.isPending || query.isFetching}>
            <header className={styles.header}>
                <div>
                    <h1>Наблюдаемость</h1>
                    <p>
                        {query.data ? (
                            <>
                                Обновлено{' '}
                                <time dateTime={query.data.generatedAt}>{formatDate(query.data.generatedAt)}</time>
                            </>
                        ) : (
                            'Без автоматического обновления'
                        )}
                    </p>
                </div>
                <button
                    type="button"
                    disabled={query.isPending || query.isFetching}
                    onClick={() => void query.refetch()}
                >
                    <AppIcon name="settings" aria-hidden="true" />
                    {query.isFetching ? 'Обновляем…' : 'Обновить снимок'}
                </button>
            </header>
            {query.isPending ? (
                <div className={styles.loading} role="status" aria-label="Загрузка состояния системы">
                    {Array.from({ length: 6 }, (_, index) => (
                        <Skeleton key={index} variant="lines" lines={3} />
                    ))}
                </div>
            ) : query.isError && !query.data ? (
                <div className={styles.error} role="alert">
                    <h2>Состояние недоступно</h2>
                    <p>{errorMessage(query.error)}</p>
                    <button type="button" onClick={() => void query.refetch()}>
                        Повторить загрузку
                    </button>
                </div>
            ) : query.data ? (
                <>
                    {query.isError && (
                        <div className={styles.refetchError} role="alert">
                            Не удалось обновить данные. Показан снимок от {formatDate(query.data.generatedAt)}.
                        </div>
                    )}
                    <ObservabilityContent data={query.data} />
                </>
            ) : null}
        </main>
    );
}
