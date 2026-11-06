import { useQuery } from '@tanstack/react-query';
import { AppIcon, Skeleton } from '@meal-planner/design-system';
import { ApiError } from '../../shared/api/client.js';
import { useRuntime } from '../../shared/runtime/index.js';
import { useStaffSession } from '../../entities/staff-session/client.js';
import { adminAiKeys, type AdminAiControlPlane } from '../../entities/admin-ai/index.js';
import styles from './ai-control.module.css';

const taskClassLabels = { standard: 'Стандартная', advanced: 'Расширенная', heavy: 'Тяжёлая' } as const;
const contextLabels = {
    user_prompt: 'Запрос',
    personal_inventory: 'Запасы',
    preferences: 'Предпочтения',
    nutrition_profile: 'Профиль питания',
} as const;
const planLabels = { free: 'Free', plus: 'Plus', pro: 'Pro' } as const;
const statusLabels = {
    preview: 'Ожидают подтверждения',
    processing: 'В обработке',
    completed: 'Завершены',
    failed: 'Ошибки',
    refunded: 'Возвращены',
} as const;
const lifecycleLabels = {
    accepted: 'Приняты',
    queued: 'В очереди',
    running: 'Выполняются',
    succeeded: 'Успешно',
    failed: 'Подтверждённые ошибки',
    cancelled: 'Отменены',
    unknown: 'Требуют сверки',
} as const;
const financialLabels = {
    none: 'Без резерва',
    reserved: 'Зарезервировано',
    captured: 'Списано',
    released: 'Освобождено',
    reconciliation_hold: 'Удержано до сверки',
} as const;
const stopLossLabels = {
    unconfigured: 'Лимит не задан',
    disabled: 'Выполнение выключено',
    ready: 'Лимит активен',
    exhausted: 'Лимит исчерпан',
} as const;

const formatDate = (value: string) =>
    new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
const formatUsd = (value: string | null) =>
    value === null
        ? '—'
        : new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(
              Number(value),
          );

function Metric({ label, value, note }: { label: string; value: number | string; note?: string }) {
    return (
        <div className={styles.metric}>
            <span>{label}</span>
            <strong>{typeof value === 'number' ? value.toLocaleString('ru-RU') : value}</strong>
            {note && <small>{note}</small>}
        </div>
    );
}

function AiControlContent({ data }: { data: AdminAiControlPlane }) {
    const refundRate = data.usage.last30Days.tasks
        ? Math.round((data.usage.last30Days.refunded / data.usage.last30Days.tasks) * 100)
        : 0;
    return (
        <>
            <section className={`${styles.hero} ${data.executionAvailable ? styles.ready : styles.blocked}`}>
                <AppIcon name={data.executionAvailable ? 'home' : 'notifications'} aria-hidden="true" />
                <div>
                    <h2>{data.executionAvailable ? 'AI-контур готов к выполнению' : 'AI-контур заблокирован'}</h2>
                    <p>
                        {data.executionAvailable
                            ? `Провайдер ${data.provider.model ?? 'не указан'}, обе политики активны.`
                            : 'Проверьте настройку провайдера и применение обеих версионированных политик.'}
                    </p>
                </div>
            </section>

            <section className={styles.metrics} aria-label="Использование AI">
                <Metric label="Задач за 24 часа" value={data.usage.last24Hours.tasks} />
                <Metric label="Действий за 24 часа" value={data.usage.last24Hours.actions} />
                <Metric label="Задач за 30 дней" value={data.usage.last30Days.tasks} />
                <Metric
                    label="Возвраты за 30 дней"
                    value={data.usage.last30Days.refunded}
                    note={`${refundRate}% задач`}
                />
            </section>

            <section className={styles.surface} aria-labelledby="ai-runtime-heading">
                <div className={styles.sectionHeading}>
                    <div>
                        <h2 id="ai-runtime-heading">Провайдер и политики</h2>
                        <p>Без секретов и персональных данных.</p>
                    </div>
                </div>
                <dl className={styles.details}>
                    <div>
                        <dt>Провайдер</dt>
                        <dd>{data.provider.configured ? 'Настроен' : 'Не настроен'}</dd>
                    </div>
                    <div>
                        <dt>Модель</dt>
                        <dd>{data.provider.model ?? '—'}</dd>
                    </div>
                    <div>
                        <dt>Pricing profile</dt>
                        <dd>{data.provider.profileVersion ?? '—'}</dd>
                    </div>
                    <div>
                        <dt>Task policy</dt>
                        <dd>{data.policies.task.version}</dd>
                    </div>
                    <div>
                        <dt>Context policy</dt>
                        <dd>{data.policies.context.version}</dd>
                    </div>
                </dl>
            </section>

            <section className={styles.surface} aria-labelledby="ai-budget-heading">
                <div className={styles.sectionHeading}>
                    <div>
                        <h2 id="ai-budget-heading">Бюджет и stop-loss</h2>
                        <p>Расходы текущего UTC-месяца; pending и unknown учитываются по консервативной оценке.</p>
                    </div>
                </div>
                {data.cost.stopLossState !== 'ready' && (
                    <div className={styles.warning} role="status">
                        <strong>{stopLossLabels[data.cost.stopLossState]}</strong>
                        <p>
                            {data.cost.stopLossState === 'exhausted'
                                ? 'Новые provider-запросы блокируются до следующего месяца или согласованного изменения лимита.'
                                : 'AI-выполнение недоступно, пока профиль, ключ и положительный месячный лимит не настроены полностью.'}
                        </p>
                    </div>
                )}
                <div className={styles.statuses}>
                    <Metric label="Месячный лимит" value={formatUsd(data.provider.monthlyBudgetUsd)} />
                    <Metric label="Фактический расход" value={formatUsd(data.cost.actualUsd)} />
                    <Metric label="Удержанная оценка" value={formatUsd(data.cost.heldUsd)} />
                    <Metric label="Остаток" value={formatUsd(data.cost.remainingUsd)} />
                </div>
                <dl className={styles.details}>
                    <div>
                        <dt>Stop-loss</dt>
                        <dd>{stopLossLabels[data.cost.stopLossState]}</dd>
                    </div>
                    <div>
                        <dt>Использование лимита</dt>
                        <dd>
                            {data.cost.utilizationPercent === null
                                ? '—'
                                : `${data.cost.utilizationPercent.toLocaleString('ru-RU')}%`}
                        </dd>
                    </div>
                    <div>
                        <dt>Начало расчётного месяца</dt>
                        <dd>{formatDate(data.cost.monthStartsAt)}</dd>
                    </div>
                </dl>
            </section>

            <section className={styles.surface} aria-labelledby="ai-status-heading">
                <div className={styles.sectionHeading}>
                    <div>
                        <h2 id="ai-status-heading">Состояния задач</h2>
                        <p>Текущий накопленный срез очереди.</p>
                    </div>
                </div>
                <div className={styles.statuses}>
                    {data.statuses.length ? (
                        data.statuses.map((item) => (
                            <Metric key={item.status} label={statusLabels[item.status]} value={item.count} />
                        ))
                    ) : (
                        <p className={styles.empty}>AI-задач пока нет.</p>
                    )}
                </div>
            </section>

            <section className={styles.surface} aria-labelledby="ai-operations-heading">
                <div className={styles.sectionHeading}>
                    <div>
                        <h2 id="ai-operations-heading">Очередь и финансовые состояния</h2>
                        <p>Канонические операции worker-контура; содержимое запросов и ответов не показывается.</p>
                    </div>
                </div>
                {(data.operations.unknownCount > 0 || data.operations.reconciliationHoldCount > 0) && (
                    <div className={styles.warning} role="alert">
                        <strong>Нужна операторская сверка</strong>
                        <p>
                            Неизвестных исходов: {data.operations.unknownCount}; резервов на удержании:{' '}
                            {data.operations.reconciliationHoldCount}. Массовый автоматический возврат запрещён.
                        </p>
                    </div>
                )}
                <div className={styles.statusGroups}>
                    <div>
                        <h3>Выполнение</h3>
                        <div className={styles.statuses}>
                            {data.operations.lifecycle.map((item) => (
                                <Metric key={item.state} label={lifecycleLabels[item.state]} value={item.count} />
                            ))}
                        </div>
                    </div>
                    <div>
                        <h3>Резервы</h3>
                        <div className={styles.statuses}>
                            {data.operations.financial.map((item) => (
                                <Metric key={item.state} label={financialLabels[item.state]} value={item.count} />
                            ))}
                        </div>
                    </div>
                </div>
                <dl className={styles.details}>
                    <div>
                        <dt>Самая старая операция в очереди</dt>
                        <dd>{data.operations.oldestQueuedAt ? formatDate(data.operations.oldestQueuedAt) : '—'}</dd>
                    </div>
                    <div>
                        <dt>Самая старая выполняемая операция</dt>
                        <dd>{data.operations.oldestRunningAt ? formatDate(data.operations.oldestRunningAt) : '—'}</dd>
                    </div>
                </dl>
            </section>

            <section className={styles.surface} aria-labelledby="ai-catalog-heading">
                <div className={styles.sectionHeading}>
                    <div>
                        <h2 id="ai-catalog-heading">Каталог задач</h2>
                        <p>Тарифный доступ и разрешённые источники контекста.</p>
                    </div>
                </div>
                <div className={styles.tableWrap}>
                    <table>
                        <thead>
                            <tr>
                                <th>Задача</th>
                                <th>Класс</th>
                                <th>Цена</th>
                                <th>Тарифы</th>
                                <th>Контекст</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.tasks.map((task) => {
                                const contexts = [
                                    ...task.requiredContext.map((value) => `${contextLabels[value]} · обязательно`),
                                    ...task.optionalContext.map((value) => contextLabels[value]),
                                ];
                                return (
                                    <tr key={task.code}>
                                        <th scope="row">
                                            <span>{task.label}</span>
                                            <small>{task.code}</small>
                                        </th>
                                        <td>{taskClassLabels[task.taskClass]}</td>
                                        <td>{task.cost}</td>
                                        <td>
                                            {task.availableOn.length
                                                ? task.availableOn.map((plan) => planLabels[plan]).join(', ')
                                                : 'Выключена'}
                                        </td>
                                        <td>{contexts.length ? contexts.join(', ') : 'Только запрос'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    );
}

function errorMessage(error: Error) {
    if (error instanceof ApiError) {
        if (error.status === 403) return 'У вашей учётной записи нет доступа к AI-контуру.';
        if (error.status === 429) return 'Слишком частое обновление. Подождите и повторите запрос.';
    }
    return 'Не удалось получить состояние AI-контура. Проверьте подключение и повторите запрос.';
}

export function AiControlPage() {
    const { api } = useRuntime();
    const session = useStaffSession('admin');
    const sessionId = session.data?.id;
    const query = useQuery({
        queryKey: adminAiKeys.snapshot(sessionId ?? 'pending'),
        enabled: !!api && !!sessionId,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        queryFn: async ({ signal }) => {
            if (!api) throw new Error('API not ready');
            return (await api.request('GET /api/v1/admin/ai', undefined, signal)).data;
        },
    });
    return (
        <main id="main" className={styles.page} aria-busy={query.isPending || query.isFetching}>
            <header className={styles.header}>
                <div>
                    <h1>AI-контур</h1>
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
                    {query.isFetching ? 'Обновляем…' : 'Обновить'}
                </button>
            </header>
            {query.isPending ? (
                <div className={styles.loading} role="status" aria-label="Загрузка AI-контура">
                    {Array.from({ length: 4 }, (_, index) => (
                        <Skeleton key={index} variant="lines" lines={3} />
                    ))}
                </div>
            ) : query.isError && !query.data ? (
                <div className={styles.error} role="alert">
                    <h2>AI-контур недоступен</h2>
                    <p>{errorMessage(query.error)}</p>
                    <button type="button" onClick={() => void query.refetch()}>
                        Повторить
                    </button>
                </div>
            ) : query.data ? (
                <AiControlContent data={query.data} />
            ) : null}
        </main>
    );
}
