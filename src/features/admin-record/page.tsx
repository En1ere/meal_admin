import { useState, type FormEvent, type ReactNode } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useRuntime } from '../../shared/runtime/index.js';
import { useStaffSession } from '../../entities/staff-session/client.js';
import { adminRecordKeys, displayStatus, recordTitle, type AdminRecord } from '../../entities/admin-record/index.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
import { Fields } from './record-fields.js';
import { RelatedCollection } from './related-collection.js';
import { detailPath, findSection, sectionPath, type Section } from '../../entities/admin-section/model.js';
import styles from './admin-record.module.css';
import { ApiError } from '../../shared/api/client.js';

export type AdminRecordDetailContext = {
    section: Section;
    id: string;
    item: AdminRecord;
    requestKind: string | null | undefined;
};

export type AdminRecordPageExtensions = {
    renderListPrelude?: (section: Section) => ReactNode;
    renderBeforeCollections?: (context: AdminRecordDetailContext) => ReactNode;
    renderDetailActions?: (context: AdminRecordDetailContext) => ReactNode;
    hasCustomActions?: (section: Section) => boolean;
};

const lookupSections: readonly Section[] = ['users', 'access', 'subscriptions'];
function OverviewLinks({ item }: { item: AdminRecord }) {
    const destinations: Record<string, Section> = {
        support_waiting: 'support',
        assigned_support: 'support',
        moderation_pending: 'queues',
        assigned_moderation: 'queues',
        jobs_failed: 'operations',
        jobs_running: 'operations',
        orders_pending: 'payments',
        attempts_failed: 'payments',
    };
    const targets = [
        ...new Set(item.fields.flatMap((field) => (destinations[field.key] ? [destinations[field.key]!] : []))),
    ];
    return (
        <div className="actions">
            {targets.map((target) => (
                <Link key={target} className="button outline" to={sectionPath(target)}>
                    {findSection(target)!.title}
                </Link>
            ))}
        </div>
    );
}
function Actions({ item }: { item: AdminRecord }) {
    if (!item.actions.length) return null;
    return (
        <section className={styles.actions}>
            <h2>Действия</h2>
            {item.actions.map((action) => (
                <div key={action.key}>
                    <button className="button outline" disabled aria-describedby={`reason-${action.key}`}>
                        {action.label}
                    </button>
                    <p id={`reason-${action.key}`} className={styles.muted}>
                        {action.reason ??
                            'Команда пока недоступна. Требуется отдельный согласованный процесс выполнения.'}
                    </p>
                </div>
            ))}
        </section>
    );
}
function ErrorPanel({ error, retry }: { error: Error; retry: () => void }) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
        <div className={styles.notice} role="alert">
            {missing ? (
                <>
                    <h2>Запись не найдена</h2>
                    <p>Возможно, она удалена или больше недоступна. Вернитесь к списку и обновите поиск.</p>
                </>
            ) : (
                <p>Не удалось получить данные. {error.message}</p>
            )}
            <button className="button outline" onClick={retry}>
                Повторить
            </button>
        </div>
    );
}
export function AdminRecordPage({
    fixedSection,
    extensions,
}: {
    fixedSection?: Section | undefined;
    extensions?: AdminRecordPageExtensions | undefined;
}) {
    const { section: sectionParam, id } = useParams();
    const section = findSection(fixedSection ?? sectionParam);
    if (!section)
        return (
            <>
                <h1>Раздел не найден</h1>
                <Link to="/admin">К обзору</Link>
            </>
        );
    return (
        <>
            {id ? (
                <Detail key={`${section.id}/${id}`} section={section.id} id={id} extensions={extensions} />
            ) : (
                <List key={section.id} section={section.id} extensions={extensions} />
            )}
        </>
    );
}
function List({ section, extensions }: { section: Section; extensions?: AdminRecordPageExtensions | undefined }) {
    const { api, queryClient } = useRuntime();
    const session = useStaffSession('admin');
    const info = findSection(section)!;
    const lookup = lookupSections.includes(section);
    const filterKey = adminRecordKeys.filters(session.data?.sessionId, section);
    const restored = queryClient.getQueryData<{ query?: string; status?: string }>(filterKey);
    const restoredQuery =
        restored && typeof restored === 'object' && 'query' in restored && typeof restored.query === 'string'
            ? restored.query
            : '';
    const restoredStatus =
        restored && typeof restored === 'object' && 'status' in restored && typeof restored.status === 'string'
            ? restored.status
            : '';
    const [draft, setDraft] = useState(restoredQuery);
    const [statusDraft, setStatusDraft] = useState(restoredStatus);
    const [search, setSearch] = useState<{ query?: string; status?: string } | null>(
        restoredQuery || restoredStatus ? { query: restoredQuery, status: restoredStatus } : lookup ? null : {},
    );
    const result = useInfiniteQuery({
        queryKey: adminRecordKeys.list(session.data?.sessionId, section, search),
        enabled: !!api && search !== null,
        initialPageParam: undefined as string | undefined,
        queryFn: async ({ signal, pageParam }) => {
            if (!api) throw new Error('Подключение не готово');
            return (
                await api.request(
                    'POST /api/v1/admin/{section}/search',
                    {
                        ...search,
                        ...(section === 'queues' ? { queue: 'recipes' } : {}),
                        limit: 20,
                        ...(pageParam ? { cursor: pageParam } : {}),
                    },
                    signal,
                    { section },
                )
            ).data;
        },
        getNextPageParam: (last) => last.nextCursor ?? undefined,
    });
    function submit(event: FormEvent) {
        event.preventDefault();
        const applied = {
            ...(draft.trim() ? { query: draft.trim() } : {}),
            ...(statusDraft.trim() ? { status: statusDraft.trim() } : {}),
        };
        queryClient.setQueryData(filterKey, applied);
        setSearch(applied);
    }
    const pages = result.data?.pages ?? [];
    const items = [...new Map(pages.flatMap((page) => page.items).map((item) => [item.id, item])).values()];
    const first = pages[0];
    return (
        <>
            <header className={styles.heading}>
                <h1>{info.title}</h1>
                <p>{info.description}</p>
                {section === 'queues' && <p>Очередь: рецепты</p>}
            </header>
            {extensions?.renderListPrelude?.(section)}
            {section !== 'overview' && (
                <form className={styles.filters} onSubmit={submit}>
                    <div>
                        <label htmlFor="admin-search">
                            {section === 'subscriptions'
                                ? 'ID подписки или владельца'
                                : lookup
                                  ? 'Идентификатор пользователя или логин'
                                  : 'Поиск'}
                        </label>
                        <input
                            id="admin-search"
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            maxLength={100}
                            required={lookup}
                            autoComplete="off"
                            placeholder={
                                section === 'subscriptions'
                                    ? 'Точный UUID'
                                    : lookup
                                      ? 'Точный UUID или логин'
                                      : 'Название или идентификатор'
                            }
                        />
                    </div>
                    {!lookup && !['sanctions', 'audit', 'rollback', 'metrics'].includes(section) && (
                        <div>
                            <label htmlFor="admin-status">Статус</label>
                            <input
                                id="admin-status"
                                value={statusDraft}
                                onChange={(event) => setStatusDraft(event.target.value)}
                                maxLength={64}
                                placeholder="Все статусы"
                            />
                        </div>
                    )}
                    <button className="button primary" type="submit" disabled={result.isFetching}>
                        {lookup ? 'Найти' : 'Применить'}
                    </button>
                    <button
                        className="button outline"
                        type="button"
                        onClick={() => {
                            setDraft('');
                            setStatusDraft('');
                            queryClient.removeQueries({ queryKey: filterKey, exact: true });
                            setSearch(lookup ? null : {});
                        }}
                    >
                        Сбросить
                    </button>
                </form>
            )}
            {search === null ? (
                <p className={styles.notice}>
                    {section === 'subscriptions'
                        ? 'Введите UUID подписки или её владельца, чтобы начать поиск.'
                        : 'Введите точный идентификатор или логин пользователя, чтобы начать поиск.'}
                </p>
            ) : (
                <>
                    <div className={styles.toolbar}>
                        <span role="status">{result.isFetching ? 'Обновляем данные…' : 'Данные текущего запроса'}</span>
                        <button
                            className="button outline"
                            disabled={result.isFetching}
                            onClick={() => void result.refetch()}
                        >
                            Обновить данные
                        </button>
                    </div>
                    {result.isPending && (
                        <ArcSkeleton height="5rem" variant="lines" lines={3} label="Загружаем раздел…" />
                    )}
                    {result.isError && <ErrorPanel error={result.error} retry={() => void result.refetch()} />}
                    {result.isError && items.length > 0 && (
                        <p role="status">Показаны ранее полученные данные. Их актуальность не подтверждена.</p>
                    )}
                    {first?.reason && <p className={styles.notice}>{first.reason}</p>}
                    {result.isSuccess && first?.availability === 'available' && !items.length && (
                        <p className={styles.notice}>По заданным условиям записей не найдено.</p>
                    )}
                    <div className={section === 'overview' ? styles.overview : styles.records}>
                        {items.map((item) => (
                            <article className={styles.card} key={item.id}>
                                <div className={styles['card-heading']}>
                                    <h2>{recordTitle(item, section)}</h2>
                                    {(section !== 'overview' || item.status !== null) && (
                                        <span className={styles.badge}>{displayStatus(item.status)}</span>
                                    )}
                                </div>
                                <Fields item={item} />
                                {section === 'overview' ? (
                                    <OverviewLinks item={item} />
                                ) : (
                                    <Link className="button outline" to={detailPath(section, item.id)}>
                                        Открыть<span className={styles['sr-only']}>: {item.title}</span>
                                    </Link>
                                )}
                            </article>
                        ))}
                    </div>
                    {result.hasNextPage && (
                        <button
                            className="button outline"
                            disabled={result.isFetching}
                            onClick={() => void result.fetchNextPage()}
                        >
                            Загрузить ещё
                        </button>
                    )}
                </>
            )}
        </>
    );
}
function Detail({
    section,
    id,
    extensions,
}: {
    section: Section;
    id: string;
    extensions?: AdminRecordPageExtensions | undefined;
}) {
    const { api, queryClient } = useRuntime();
    const session = useStaffSession('admin');
    const info = findSection(section)!;
    const result = useQuery({
        queryKey: adminRecordKeys.detail(session.data?.sessionId, section, id),
        enabled: !!api,
        queryFn: async ({ signal }) => {
            if (!api) throw new Error('Подключение не готово');
            return (await api.request('GET /api/v1/admin/{section}/{id}', undefined, signal, { section, id })).data;
        },
    });
    const requestKind = result.data?.item.fields.find((field) => field.key === 'kind')?.value;
    return (
        <>
            <Link to={sectionPath(section)}>К разделу «{info.title}»</Link>
            {result.isPending && <ArcSkeleton height="5rem" variant="lines" lines={4} label="Загружаем карточку…" />}
            {result.isError && <ErrorPanel error={result.error} retry={() => void result.refetch()} />}
            {result.data && (
                <>
                    <header className={styles.heading}>
                        <h1>{recordTitle(result.data.item, section)}</h1>
                        <p>{displayStatus(result.data.item.status)}</p>
                        <p className={styles['record-id']}>Идентификатор: {result.data.item.id}</p>
                    </header>
                    <div className={styles.toolbar}>
                        <span className={styles.muted}>
                            {result.data.item.updatedAt
                                ? `Обновлено: ${new Date(result.data.item.updatedAt).toLocaleString()}`
                                : 'Время обновления не указано'}
                        </span>
                        <button
                            className="button outline"
                            disabled={result.isFetching}
                            onClick={() => {
                                void result.refetch();
                                void queryClient.invalidateQueries({
                                    queryKey: adminRecordKeys.related(session.data?.sessionId, section, id),
                                });
                            }}
                        >
                            Обновить данные
                        </button>
                    </div>
                    {result.isError && <p role="status">Данные могут быть устаревшими.</p>}
                    <article className={styles.card}>
                        <Fields item={result.data.item} />
                    </article>
                    {result.data.item.related.length > 0 && (
                        <section className={styles.card}>
                            <h2>Связанные записи</h2>
                            <ul className={styles.related}>
                                {result.data.item.related.map((link, index) => (
                                    <li key={`${link.section}/${link.id}/${index}`}>
                                        <Link to={detailPath(link.section, link.id)}>{link.label}</Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                    {extensions?.renderBeforeCollections?.({
                        section,
                        id,
                        item: result.data.item,
                        requestKind,
                    })}
                    <div className={styles['detail-collections']}>
                        {result.data.collections.map((collection) => (
                            <RelatedCollection
                                key={collection.key}
                                section={section}
                                id={id}
                                collection={collection.key}
                                label={collection.label}
                            />
                        ))}
                    </div>
                    {extensions?.renderDetailActions?.({
                        section,
                        id,
                        item: result.data.item,
                        requestKind,
                    })}
                    {!extensions?.hasCustomActions?.(section) && <Actions item={result.data.item} />}
                </>
            )}
        </>
    );
}
