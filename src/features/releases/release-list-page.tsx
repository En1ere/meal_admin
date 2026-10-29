import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLoader as ArcPageLoader } from '@meal-planner/design-system';
import { useRuntime } from '../../shared/runtime/index.js';
import { ApiError } from '../../shared/api/client.js';
import { runReleaseCommand } from './api.js';
import { releaseWorkspaceKey, useReleaseWorkspace } from './workspace.js';
import type { Release } from './contracts.js';
import { statusLabel } from './release-model.js';
import styles from './releases.module.css';

export function ReleaseSummary({ release }: { release: Release }) {
    const counts = release.changes.reduce<Record<string, number>>((result, change) => {
        result[change.entityType] = (result[change.entityType] ?? 0) + 1;
        return result;
    }, {});
    return (
        <dl className={styles.summary}>
            <div className={styles['summary-item']}>
                <dt>Изменений</dt>
                <dd>{release.changes.length}</dd>
            </div>
            <div className={styles['summary-item']}>
                <dt>Достижения</dt>
                <dd>{counts.achievement ?? 0}</dd>
            </div>
            <div className={styles['summary-item']}>
                <dt>Звания</dt>
                <dd>{counts.reputation ?? 0}</dd>
            </div>
            <div className={styles['summary-item']}>
                <dt>Документы</dt>
                <dd>{counts.content_document ?? 0}</dd>
            </div>
            <div className={styles['summary-item']}>
                <dt>Справочники</dt>
                <dd>{counts.dictionary_entry ?? 0}</dd>
            </div>
            <div className={styles['summary-item']}>
                <dt>Версия</dt>
                <dd>{release.version}</dd>
            </div>
        </dl>
    );
}

export function ReleasesPage() {
    const workspace = useReleaseWorkspace();
    const { api, queryClient } = useRuntime();
    const navigate = useNavigate();
    const [tab, setTab] = useState<'drafts' | 'history'>('drafts');
    const [name, setName] = useState('');
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const releases = workspace.data?.releases.filter((release) =>
        tab === 'drafts'
            ? release.status !== 'published'
            : release.status === 'published' || release.events.some((event) => event.kind === 'rolled_back'),
    );
    async function create(event: FormEvent) {
        event.preventDefault();
        if (!api || pending || !name.trim()) return;
        setPending(true);
        setError('');
        try {
            const result = await runReleaseCommand(api, {
                action: 'create',
                title: name.trim(),
                idempotencyKey: crypto.randomUUID(),
            });
            queryClient.setQueryData(releaseWorkspaceKey, result.workspace);
            const created = result.workspace.releases[0];
            if (created) void navigate(`/admin/releases/${created.id}`);
        } catch (failure) {
            setError(failure instanceof ApiError ? failure.message : 'Не удалось создать релиз.');
        } finally {
            setPending(false);
        }
    }
    return (
        <>
            <header className={styles['page-heading']}>
                <div className={styles['conflict-actions']}>
                    <p className={styles.eyebrow}>Контент</p>
                    <h1>Релизы</h1>
                    <p>Пакеты изменений публикуются атомарно после проверки.</p>
                </div>
                <form onSubmit={(event) => void create(event)} className={styles['create-form']}>
                    <label>
                        Название нового релиза
                        <input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            maxLength={160}
                            placeholder="Например, Осеннее обновление"
                        />
                    </label>
                    <button className="button primary" disabled={pending || !name.trim()}>
                        {pending ? 'Создаём…' : 'Создать релиз'}
                    </button>
                </form>
            </header>
            {error && (
                <p role="alert" className={styles.error}>
                    {error}
                </p>
            )}
            <div className={styles.tabs} role="tablist" aria-label="Релизы">
                <button role="tab" aria-selected={tab === 'drafts'} onClick={() => setTab('drafts')}>
                    В работе
                </button>
                <button role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>
                    История
                </button>
            </div>
            {workspace.isPending ? (
                <ArcPageLoader label="Загружаем релизы…" />
            ) : workspace.isError ? (
                <button className="button outline" onClick={() => void workspace.refetch()}>
                    Повторить загрузку
                </button>
            ) : !releases?.length ? (
                <section className={styles.empty}>
                    <h2>{tab === 'drafts' ? 'Черновиков пока нет' : 'История пока пуста'}</h2>
                    <p>Создайте релиз и соберите в нём изменения каталога.</p>
                </section>
            ) : (
                <div className={styles['release-grid']}>
                    {releases.map((release) => (
                        <button
                            key={release.id}
                            className={styles['release-card']}
                            onClick={() => void navigate(`/admin/releases/${release.id}`)}
                        >
                            <span className={styles.status}>{statusLabel[release.status]}</span>
                            <h2>{release.title}</h2>
                            <p>
                                {release.changes.length} изменений · обновлён{' '}
                                {new Date(release.updatedAt).toLocaleString('ru-RU')}
                            </p>
                            <ReleaseSummary release={release} />
                        </button>
                    ))}
                </div>
            )}
        </>
    );
}
