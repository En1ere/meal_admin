import { useMemo, useState } from 'react';
import { AppIcon, InlineLoader, Skeleton } from '@meal-planner/design-system';
import { CriticalConfirmation } from '../auth/access-client.js';
import {
    runtimeReadinessLabels,
    runtimeSettingSections,
    runtimeStatusLabels,
    type RuntimeSetting,
    type RuntimeSettingSection,
    type RuntimeSettingsRegistry,
    type WebPushPolicy,
} from './model.js';
import { useExecuteWebPushPolicy, usePreviewWebPushPolicy, useRuntimeSettings } from './runtime-settings-api.js';
import styles from './runtime-settings.module.css';

const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }) : 'Изменений нет';

function PolicyEditor({ item, close }: { item: RuntimeSetting; close: () => void }) {
    const initial = item.editablePolicy!;
    const [draft, setDraft] = useState<WebPushPolicy>(initial);
    const [previewId, setPreviewId] = useState<string | null>(null);
    const preview = usePreviewWebPushPolicy();
    const execute = useExecuteWebPushPolicy();
    const ttl = draft.ttlSeconds;
    const changed = JSON.stringify(initial) !== JSON.stringify(draft);
    if (previewId)
        return (
            <section className={styles.editor} aria-labelledby="runtime-policy-preview">
                <h3 id="runtime-policy-preview">Предпросмотр изменений</h3>
                <dl className={styles.details}>
                    <div>
                        <dt>Тихие часы</dt>
                        <dd>
                            {draft.quietHours.start}–{draft.quietHours.end}
                        </dd>
                    </div>
                    <div>
                        <dt>Критичные</dt>
                        <dd>{ttl.critical} сек.</dd>
                    </div>
                    <div>
                        <dt>Важные</dt>
                        <dd>{ttl.important} сек.</dd>
                    </div>
                    <div>
                        <dt>Информационные</dt>
                        <dd>{ttl.informational} сек.</dd>
                    </div>
                    <div>
                        <dt>Маркетинговые</dt>
                        <dd>{ttl.marketing} сек.</dd>
                    </div>
                </dl>
                <p>Команда связана с версией {item.version}. При конфликте данные будут перечитаны без перезаписи.</p>
                <CriticalConfirmation />
                <div className={styles.actions}>
                    <button
                        className="button primary"
                        disabled={execute.isPending}
                        onClick={() =>
                            execute.mutate(
                                { expectedVersion: item.version, policy: draft, previewId },
                                { onSuccess: close },
                            )
                        }
                    >
                        {execute.isPending && <InlineLoader label={null} />}Подтвердить и применить
                    </button>
                    <button className="button outline" disabled={execute.isPending} onClick={() => setPreviewId(null)}>
                        Назад
                    </button>
                </div>
                {execute.isError && (
                    <p role="alert">Изменение не подтверждено. Перечитайте реестр и повторите команду.</p>
                )}
            </section>
        );
    return (
        <section className={styles.editor} aria-labelledby="runtime-policy-edit">
            <h3 id="runtime-policy-edit">Изменить Web Push policy</h3>
            <div className={styles.formGrid}>
                <label>
                    Начало тихих часов
                    <input
                        type="time"
                        value={draft.quietHours.start}
                        onChange={(event) =>
                            setDraft({ ...draft, quietHours: { ...draft.quietHours, start: event.target.value } })
                        }
                    />
                </label>
                <label>
                    Конец тихих часов
                    <input
                        type="time"
                        value={draft.quietHours.end}
                        onChange={(event) =>
                            setDraft({ ...draft, quietHours: { ...draft.quietHours, end: event.target.value } })
                        }
                    />
                </label>
                {(['critical', 'important', 'informational', 'marketing'] as const).map((key) => (
                    <label key={key}>
                        TTL · {key}
                        <input
                            type="number"
                            min={60}
                            max={86400}
                            step={60}
                            value={ttl[key]}
                            onChange={(event) =>
                                setDraft({ ...draft, ttlSeconds: { ...ttl, [key]: Number(event.target.value) } })
                            }
                        />
                    </label>
                ))}
            </div>
            <div className={styles.actions}>
                <button
                    className="button primary"
                    disabled={!changed || preview.isPending || draft.quietHours.start === draft.quietHours.end}
                    onClick={() =>
                        preview.mutate(
                            { expectedVersion: item.version, policy: draft },
                            { onSuccess: (value) => setPreviewId(value.previewId) },
                        )
                    }
                >
                    {preview.isPending && <InlineLoader label={null} />}Предпросмотр
                </button>
                <button className="button outline" onClick={close}>
                    Отмена
                </button>
            </div>
            {preview.isError && (
                <p role="alert">Backend не принял предпросмотр. Перечитайте актуальную версию настройки.</p>
            )}
        </section>
    );
}

function DetailsPanel({ item, close }: { item: RuntimeSetting; close: () => void }) {
    const [editing, setEditing] = useState(false);
    return (
        <aside className={styles.panel} aria-labelledby="runtime-setting-title">
            <div className={styles.panelHeader}>
                <div>
                    <span className={`${styles.status} ${styles[item.status]}`}>
                        {runtimeStatusLabels[item.status]}
                    </span>
                    <h2 id="runtime-setting-title">{item.title}</h2>
                </div>
                <button className="button outline" onClick={close} aria-label="Закрыть карточку настройки">
                    Закрыть
                </button>
            </div>
            <p>{item.description}</p>
            <dl className={styles.details}>
                <div>
                    <dt>Текущее значение</dt>
                    <dd>{item.displayValue}</dd>
                </div>
                <div>
                    <dt>Источник</dt>
                    <dd>{item.source}</dd>
                </div>
                <div>
                    <dt>Готовность</dt>
                    <dd>{runtimeReadinessLabels[item.readiness]}</dd>
                </div>
                <div>
                    <dt>Версия</dt>
                    <dd>{item.version}</dd>
                </div>
                <div>
                    <dt>Последнее изменение</dt>
                    <dd>{formatDate(item.lastChangedAt)}</dd>
                </div>
            </dl>
            {item.secret && (
                <section className={styles.safeSecret} aria-label="Состояние секрета">
                    <strong>{item.secret.configured ? 'Секрет настроен' : 'Секрет отсутствует'}</strong>
                    <p>Значение никогда не передаётся в admin UI.</p>
                    {item.secret.fingerprint && (
                        <p>
                            Fingerprint: <code>{item.secret.fingerprint}</code>
                        </p>
                    )}
                    {item.secret.rotatedAt && <p>Ротация: {formatDate(item.secret.rotatedAt)}</p>}
                </section>
            )}
            <section>
                <h3>Затронутые сервисы</h3>
                <ul>
                    {item.affectedServices.map((value) => (
                        <li key={value}>{value}</li>
                    ))}
                </ul>
            </section>
            <section>
                <h3>Проверки</h3>
                {item.checks.length ? (
                    <ul>
                        {item.checks.map((value) => (
                            <li key={value}>{value}</li>
                        ))}
                    </ul>
                ) : (
                    <p>Автоматические проверки не зарегистрированы.</p>
                )}
            </section>
            {item.blockers.length > 0 && (
                <section className={styles.blockers}>
                    <h3>Блокеры</h3>
                    <ul>
                        {item.blockers.map((value) => (
                            <li key={value}>{value}</li>
                        ))}
                    </ul>
                </section>
            )}
            {item.instruction && (
                <section>
                    <h3>{item.section === 'backup_recovery' ? 'Как сохранить безопасно' : 'Как изменить'}</h3>
                    <p>{item.instruction}</p>
                </section>
            )}
            {item.editablePolicy && !editing && (
                <button className="button primary" onClick={() => setEditing(true)}>
                    Изменить policy
                </button>
            )}
            {editing && (
                <PolicyEditor
                    item={item}
                    close={() => {
                        setEditing(false);
                        close();
                    }}
                />
            )}
            <section>
                <h3>История</h3>
                {item.history.length ? (
                    <ol className={styles.history}>
                        {item.history.map((event) => (
                            <li key={`${event.at}-${event.summary}`}>
                                <time dateTime={event.at}>{formatDate(event.at)}</time>
                                <strong>{event.summary}</strong>
                                <span>{event.actor}</span>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p>Изменения ещё не зафиксированы.</p>
                )}
            </section>
        </aside>
    );
}

function Registry({
    registry,
    section,
    setSection,
}: {
    registry: RuntimeSettingsRegistry;
    section: RuntimeSettingSection;
    setSection: (value: RuntimeSettingSection) => void;
}) {
    const [selected, setSelected] = useState<string | null>(null);
    const items = useMemo(() => registry.items.filter((item) => item.section === section), [registry.items, section]);
    const item = registry.items.find((candidate) => candidate.id === selected) ?? null;
    return (
        <>
            {registry.completeness === 'partial' && (
                <aside className={styles.partialNotice} role="status">
                    <strong>Реестр загружен частично</strong>
                    <p>Недоступные источники: {registry.unavailableSources.join(', ') || 'не указаны'}.</p>
                </aside>
            )}
            <nav className={styles.tabs} aria-label="Разделы конфигурации">
                {runtimeSettingSections.map(([id, label]) => (
                    <button
                        key={id}
                        aria-current={section === id ? 'page' : undefined}
                        onClick={() => {
                            setSection(id);
                            setSelected(null);
                        }}
                    >
                        {label}
                    </button>
                ))}
            </nav>
            <div className={styles.layout}>
                <section className={styles.table} aria-labelledby="runtime-settings-table">
                    <div className={styles.tableTitle}>
                        <h2 id="runtime-settings-table">Текущая конфигурация</h2>
                        <p>Снимок {formatDate(registry.generatedAt)}</p>
                    </div>
                    <div className={styles.tableHead} aria-hidden="true">
                        <span>Параметр</span>
                        <span>Состояние / готовность</span>
                        <span>Источник</span>
                        <span>Изменено</span>
                    </div>
                    {items.length ? (
                        items.map((row) => (
                            <button
                                key={row.id}
                                className={styles.tableRow}
                                aria-pressed={selected === row.id}
                                onClick={() => setSelected(row.id)}
                            >
                                <span>
                                    <strong>{row.title}</strong>
                                    <small>{row.displayValue}</small>
                                </span>
                                <span className={styles.stateCell} data-label="Состояние / готовность">
                                    <span className={`${styles.status} ${styles[row.status]}`}>
                                        {runtimeStatusLabels[row.status]}
                                    </span>
                                    <small>{runtimeReadinessLabels[row.readiness]}</small>
                                </span>
                                <span data-label="Источник">{row.source}</span>
                                <span data-label="Изменено">{formatDate(row.lastChangedAt)}</span>
                            </button>
                        ))
                    ) : (
                        <div className={styles.empty}>
                            <AppIcon name="settings" aria-hidden="true" />
                            <strong>В разделе пока нет параметров</strong>
                            <p>Настройки появятся только после подключения проверенного backend-источника.</p>
                        </div>
                    )}
                </section>
                {item ? (
                    <DetailsPanel item={item} close={() => setSelected(null)} />
                ) : (
                    <aside className={styles.placeholder}>
                        <AppIcon name="settings" aria-hidden="true" />
                        <h2>Выберите параметр</h2>
                        <p>Здесь появятся источник, проверки, блокеры и безопасная история настройки.</p>
                    </aside>
                )}
            </div>
        </>
    );
}

export function RuntimeSettingsPage() {
    const [section, setSection] = useState<RuntimeSettingSection>('notifications');
    const query = useRuntimeSettings(section);
    return (
        <main id="main" className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1>Конфигурация сервиса</h1>
                    <p>Единый безопасный реестр решений, провайдеров и эксплуатационных настроек.</p>
                </div>
                <button className="button outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
                    {query.isFetching && <InlineLoader label={null} />}Обновить
                </button>
            </header>
            {query.isFetching && !query.isPending && (
                <p className={styles.refreshing} role="status">
                    Проверяем актуальность снимка…
                </p>
            )}
            {query.isPending ? (
                <Skeleton variant="lines" lines={8} label="Загружаем конфигурацию…" />
            ) : query.isError ? (
                <section className={styles.error} role="alert">
                    <h2>Реестр недоступен</h2>
                    <p>Настройки не подменены локальными значениями. Проверьте доступ и повторите запрос.</p>
                    <button className="button outline" onClick={() => void query.refetch()}>
                        Повторить
                    </button>
                </section>
            ) : (
                <Registry registry={query.data} section={section} setSection={setSection} />
            )}
        </main>
    );
}
