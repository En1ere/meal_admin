import { CriticalConfirmation } from '../auth/access-client.js';
import type { Release, ReleaseChange } from './contracts.js';
import { statusLabel } from './release-model.js';
import { ReleaseSummary } from './release-list-page.js';
import styles from './releases.module.css';

type ReleaseAction = 'validate' | 'publish' | 'rollback' | 'reopen';
type SaveStatus = 'idle' | 'local' | 'saving' | 'saved' | 'conflict';

export function ReleaseDetailHeader({
    release,
    title,
    saveStatus,
    error,
    onBack,
    onTitleChange,
    onLoadServer,
    onUseLocal,
}: {
    release: Release;
    title: string;
    saveStatus: SaveStatus;
    error: string;
    onBack: () => void;
    onTitleChange: (title: string) => void;
    onLoadServer: () => void;
    onUseLocal: () => void;
}) {
    return (
        <>
            <header className={styles['detail-heading']}>
                <div>
                    <button className="text-button" onClick={onBack}>
                        Контент / Релизы
                    </button>
                    <div className={styles['title-line']}>
                        <input
                            aria-label="Название релиза"
                            value={title}
                            disabled={release.status === 'published'}
                            onChange={(event) => onTitleChange(event.target.value)}
                        />
                        <span className={styles.status}>{statusLabel[release.status]}</span>
                    </div>
                    <p>Набор изменений контента, готовый к проверке и публикации.</p>
                </div>
                <div className={styles['save-state']} aria-live="polite">
                    {
                        {
                            idle: '',
                            local: 'Локальная копия обновлена',
                            saving: 'Сохраняем на сервере…',
                            saved: `Сохранено ${new Date(release.updatedAt).toLocaleTimeString('ru-RU')}`,
                            conflict: 'Конфликт версий',
                        }[saveStatus]
                    }
                </div>
            </header>
            <ol className={styles.steps}>
                <li className={release.status === 'draft' ? styles.current : ''}>
                    <b>1</b> Состав
                </li>
                <li className={release.status === 'ready' ? styles.current : ''}>
                    <b>2</b> Проверка
                </li>
                <li className={release.status === 'published' ? styles.current : ''}>
                    <b>3</b> Публикация
                </li>
            </ol>
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
            {saveStatus === 'conflict' && (
                <section className={styles.conflict} role="alert">
                    <h2>Черновик изменён на сервере</h2>
                    <p>Локальная копия сохранена. Выберите, какую версию продолжить.</p>
                    <div>
                        <button className="button outline" onClick={onLoadServer}>
                            Загрузить серверную
                        </button>
                        <button className="button outline" onClick={onUseLocal}>
                            Применить локальную поверх новой
                        </button>
                    </div>
                </section>
            )}
        </>
    );
}

export function ReleaseSidebar({
    release,
    changes,
    dirty,
    pendingAction,
    onAction,
}: {
    release: Release;
    changes: ReleaseChange[];
    dirty: boolean;
    pendingAction: string;
    onAction: (action: ReleaseAction) => void;
}) {
    return (
        <aside className={styles['sidebar-card']}>
            <h2>Итоги релиза</h2>
            <ReleaseSummary release={{ ...release, changes }} />
            <hr />
            <button
                className="button outline"
                disabled={dirty || !!pendingAction || release.status === 'published'}
                onClick={() => onAction('validate')}
            >
                {pendingAction === 'validate' ? 'Проверяем…' : 'Проверить релиз'}
            </button>
            {release.validation.errors.map((item) => (
                <p className={styles.error} key={item}>
                    ● {item}
                </p>
            ))}
            {release.validation.warnings.map((item) => (
                <p className={styles.warning} key={item}>
                    ▲ {item}
                </p>
            ))}
            {release.status === 'ready' && (
                <>
                    <CriticalConfirmation />
                    <button
                        className="button primary"
                        disabled={dirty || !!pendingAction}
                        onClick={() => onAction('publish')}
                    >
                        {pendingAction === 'publish' ? 'Публикуем…' : 'Опубликовать релиз'}
                    </button>
                </>
            )}
            {release.status === 'published' && (
                <>
                    <CriticalConfirmation />
                    <button className="button outline" disabled={!!pendingAction} onClick={() => onAction('rollback')}>
                        {pendingAction === 'rollback' ? 'Откатываем…' : 'Откатить в черновик'}
                    </button>
                    <button className="button outline" disabled={!!pendingAction} onClick={() => onAction('reopen')}>
                        Изменить как новую редакцию
                    </button>
                </>
            )}
            <hr />
            <h3>История</h3>
            {release.events.toReversed().map((entry) => (
                <p key={entry.id} className={styles.event}>
                    {new Date(entry.at).toLocaleString('ru-RU')} · {entry.kind} · v{entry.version}
                </p>
            ))}
        </aside>
    );
}
