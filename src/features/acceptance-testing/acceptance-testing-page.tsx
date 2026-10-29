import { useMemo, useState } from 'react';
import { AppIcon, Skeleton, type AppIconName } from '@meal-planner/design-system';
import {
    acceptanceStatusDescriptions,
    acceptanceStatusLabels,
    adjacentAcceptanceCase,
    checkedByLabel,
    filterAcceptanceGroups,
    flattenAcceptanceCases,
    formatAcceptanceDate,
    groupProgress,
    orderedGroups,
    type AcceptanceCase,
    type AcceptanceFilter,
    type AcceptanceStatus,
} from '../../entities/acceptance-test/index.js';
import { useStaffSession } from '../../entities/staff-session/client.js';
import { ApiError } from '../../shared/api/client.js';
import {
    acceptanceDraftFingerprint,
    createAcceptanceResetCommand,
    createAcceptanceSaveCommand,
    draftFromResult,
    isAcceptanceDraftDirty,
    type AcceptanceDraft,
} from './draft-model.js';
import { useAcceptanceWorkspace } from './use-acceptance-workspace.js';
import styles from './acceptance-testing.module.css';

const statuses: AcceptanceStatus[] = ['not_tested', 'passed', 'partial', 'failed'];
const groupIcons: Record<string, AppIconName> = {
    database: 'inventory',
    backend: 'settings',
    admin: 'profile',
    frontend: 'home',
};

function queryErrorMessage(error: Error) {
    if (error instanceof ApiError && error.status === 403)
        return 'У вашей учётной записи нет доступа к программе приёмки.';
    return 'Не удалось загрузить программу приёмки. Проверьте подключение и повторите запрос.';
}

function LoadingState() {
    return (
        <div className={styles.loading} role="status" aria-label="Загрузка программы приёмки">
            <Skeleton variant="lines" lines={7} />
            <Skeleton variant="lines" lines={12} />
        </div>
    );
}

function EmptyState({ retry }: { retry: () => void }) {
    return (
        <section className={styles.empty}>
            <h2>Каталог тестов пока пуст</h2>
            <p>Проверьте публикацию каталога на backend или повторите загрузку.</p>
            <button type="button" className="button outline" onClick={retry}>
                Повторить загрузку
            </button>
        </section>
    );
}

function CaseDetail({
    item,
    groupTitle,
    draft,
    pending,
    hasFrozenAttempt,
    onChange,
    onPrevious,
    onSave,
    onSaveAndNext,
    onReset,
}: {
    item: AcceptanceCase;
    groupTitle: string;
    draft: AcceptanceDraft;
    pending: boolean;
    hasFrozenAttempt: boolean;
    onChange: (draft: AcceptanceDraft) => void;
    onPrevious: () => void;
    onSave: () => void;
    onSaveAndNext: () => void;
    onReset: () => void;
}) {
    const dirty = isAcceptanceDraftDirty(draft, item.result);
    const canSave = draft.status !== 'not_tested' && dirty && !pending && !hasFrozenAttempt;
    return (
        <article className={styles.detail} aria-labelledby="acceptance-case-title">
            <header className={styles.detailHeader}>
                <p className={styles.breadcrumb}>
                    {groupTitle} / {item.displayCode}
                </p>
                <h2 id="acceptance-case-title" tabIndex={-1}>
                    {item.title}
                </h2>
                <p className={styles.source}>
                    Источник: <code>{item.source.file}</code>
                </p>
            </header>

            <section className={styles.detailSection} aria-labelledby="acceptance-steps">
                <h3 id="acceptance-steps">Шаги проверки</h3>
                <ol className={styles.steps}>
                    {item.steps.map((step, index) => (
                        <li key={`${item.id}-step-${index}`}>{step}</li>
                    ))}
                </ol>
            </section>

            <section className={styles.detailSection} aria-labelledby="acceptance-expected">
                <h3 id="acceptance-expected">Ожидаемый результат</h3>
                <p>{item.expectedResult}</p>
            </section>

            <fieldset className={styles.statusFieldset} disabled={pending || hasFrozenAttempt}>
                <legend>Результат проверки</legend>
                <div className={styles.statusGrid}>
                    {statuses.map((status) => (
                        <label
                            key={status}
                            className={`${styles.statusCard} ${styles[status]} ${draft.status === status ? styles.selectedStatus : ''}`}
                        >
                            <input
                                type="radio"
                                name={`acceptance-status-${item.id}`}
                                value={status}
                                checked={draft.status === status}
                                disabled={status === 'not_tested'}
                                onChange={() => onChange({ ...draft, status })}
                            />
                            <span>
                                <strong>{acceptanceStatusLabels[status]}</strong>
                                <small>{acceptanceStatusDescriptions[status]}</small>
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <label className={styles.commentLabel}>
                <span>Комментарий</span>
                <textarea
                    value={draft.comment}
                    maxLength={1000}
                    rows={5}
                    disabled={pending || hasFrozenAttempt}
                    placeholder="Зафиксируйте замечания, условия проверки или причину частичного результата"
                    onChange={(event) => onChange({ ...draft, comment: event.target.value })}
                />
                <small aria-live="polite">{draft.comment.length} / 1000</small>
            </label>

            <footer className={styles.detailFooter}>
                <div className={styles.audit}>
                    <span>
                        {item.result.status === 'not_tested' && item.result.checkedBy
                            ? 'Вернул на проверку'
                            : 'Проверил'}{' '}
                        <strong>{checkedByLabel(item.result.checkedBy)}</strong>
                    </span>
                    <span>
                        Обновлено <strong>{formatAcceptanceDate(item.result.updatedAt)}</strong>
                    </span>
                </div>
                <button
                    type="button"
                    className={styles.resetButton}
                    disabled={pending || hasFrozenAttempt || (item.result.status === 'not_tested' && !dirty)}
                    onClick={onReset}
                >
                    {item.result.status === 'not_tested' ? 'Отменить изменения' : 'Вернуть на проверку'}
                </button>
                <div className={styles.actions}>
                    <button type="button" className="button outline" disabled={pending} onClick={onPrevious}>
                        Назад
                    </button>
                    <button type="button" className="button outline" disabled={!canSave} onClick={onSave}>
                        {pending ? 'Сохраняем…' : 'Сохранить'}
                    </button>
                    <button type="button" className="button primary" disabled={!canSave} onClick={onSaveAndNext}>
                        Сохранить и далее
                    </button>
                </div>
            </footer>
        </article>
    );
}

export function AcceptanceTestingPage() {
    const session = useStaffSession('admin');
    const workspace = useAcceptanceWorkspace(session.data?.id);
    const data = workspace.query.data;
    const groups = useMemo(() => (data ? orderedGroups(data) : []), [data]);
    const allCases = useMemo(() => flattenAcceptanceCases(groups), [groups]);
    const [selectedId, setSelectedId] = useState('');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<AcceptanceFilter>('all');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [drafts, setDrafts] = useState<Record<string, AcceptanceDraft>>({});

    const filteredGroups = useMemo(() => filterAcceptanceGroups(groups, search, filter), [filter, groups, search]);
    const visibleCases = useMemo(() => flattenAcceptanceCases(filteredGroups), [filteredGroups]);
    const selected =
        (visibleCases.length
            ? (visibleCases.find((item) => item.id === selectedId) ?? visibleCases[0])
            : allCases.find((item) => item.id === selectedId)) ??
        allCases[0] ??
        null;
    const selectedGroupTitle =
        groups.find((group) => group.cases.some((item) => item.id === selected?.id))?.title ?? '';
    const selectedDraft = selected ? (drafts[selected.id] ?? draftFromResult(selected.result)) : null;

    function updateDraft(item: AcceptanceCase, next: AcceptanceDraft) {
        setDrafts((current) => ({ ...current, [item.id]: next }));
        workspace.clearFailure();
    }

    function selectAdjacent(direction: -1 | 1) {
        if (!selected) return;
        const next = adjacentAcceptanceCase(visibleCases.length ? visibleCases : allCases, selected.id, direction);
        if (next) setSelectedId(next.id);
    }

    async function save(moveNext: boolean) {
        if (!selected || !selectedDraft) return;
        const command = createAcceptanceSaveCommand(selectedDraft, selected.result.version);
        if (!command) return;
        const fingerprint = acceptanceDraftFingerprint(selectedDraft, selected.result.version);
        const succeeded = await workspace.save(selected.id, command, fingerprint);
        if (!succeeded) return;
        setDrafts((current) => {
            const next = { ...current };
            delete next[selected.id];
            return next;
        });
        if (moveNext) selectAdjacent(1);
    }

    async function reset() {
        if (!selected) return;
        if (selected.result.status === 'not_tested') {
            setDrafts((current) => {
                const next = { ...current };
                delete next[selected.id];
                return next;
            });
            workspace.clearFailure();
            return;
        }
        const succeeded = await workspace.reset(selected.id, createAcceptanceResetCommand(selected.result.version));
        if (!succeeded) return;
        setDrafts((current) => {
            const next = { ...current };
            delete next[selected.id];
            return next;
        });
    }

    return (
        <main id="main" className={styles.page} aria-busy={workspace.query.isPending || workspace.pending}>
            <header className={styles.pageHeader}>
                <h1>Приёмочное тестирование</h1>
                {data && (
                    <p>
                        <strong>
                            {data.summary.completed} из {data.summary.total} проверено
                        </strong>
                        <span aria-hidden="true">·</span>
                        Каталог от{' '}
                        <time dateTime={data.catalog.publishedOn}>
                            {formatAcceptanceDate(data.catalog.publishedOn)}
                        </time>
                    </p>
                )}
            </header>

            {workspace.query.isPending ? (
                <LoadingState />
            ) : workspace.query.isError && !data ? (
                <section className={styles.error} role="alert">
                    <h2>Программа приёмки недоступна</h2>
                    <p>{queryErrorMessage(workspace.query.error)}</p>
                    <button type="button" className="button outline" onClick={() => void workspace.query.refetch()}>
                        Повторить загрузку
                    </button>
                </section>
            ) : !data || !allCases.length ? (
                <EmptyState retry={() => void workspace.query.refetch()} />
            ) : (
                <>
                    {workspace.query.isError && (
                        <div className={styles.warning} role="alert">
                            Не удалось обновить каталог. Показаны последние доступные данные.
                        </div>
                    )}
                    {workspace.failure && (
                        <div className={`${styles.mutationMessage} ${styles[workspace.failure.kind]}`} role="alert">
                            <span>{workspace.failure.message}</span>
                            {workspace.hasFrozenAttempt && (
                                <button
                                    type="button"
                                    className="button outline"
                                    onClick={() => void workspace.retryFrozen()}
                                >
                                    Повторить ту же команду
                                </button>
                            )}
                        </div>
                    )}
                    <div className={styles.workspace}>
                        <aside className={styles.catalog} aria-label="Каталог тест-кейсов">
                            <div className={styles.catalogTools}>
                                <label className={styles.searchField}>
                                    <span className={styles.srOnly}>Поиск по кейсам</span>
                                    <AppIcon name="search" aria-hidden="true" />
                                    <input
                                        type="search"
                                        value={search}
                                        placeholder="Поиск по кейсам…"
                                        onChange={(event) => setSearch(event.target.value)}
                                    />
                                </label>
                                <label className={styles.filterField}>
                                    <span className={styles.srOnly}>Статус кейса</span>
                                    <select
                                        value={filter}
                                        onChange={(event) => setFilter(event.target.value as AcceptanceFilter)}
                                    >
                                        <option value="all">Все статусы</option>
                                        {statuses.map((status) => (
                                            <option key={status} value={status}>
                                                {acceptanceStatusLabels[status]}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <div className={styles.catalogColumns} aria-hidden="true">
                                <span>Кейс</span>
                                <span>Статус</span>
                            </div>
                            <div className={styles.groupList}>
                                {filteredGroups.length ? (
                                    filteredGroups.map((group) => {
                                        const progress = groupProgress(
                                            groups.find((item) => item.id === group.id) ?? group,
                                        );
                                        const isExpanded = !collapsedGroups.has(group.id);
                                        return (
                                            <section key={group.id} className={styles.group}>
                                                <button
                                                    type="button"
                                                    className={styles.groupHeader}
                                                    aria-expanded={isExpanded}
                                                    onClick={() =>
                                                        setCollapsedGroups((current) => {
                                                            const next = new Set(current);
                                                            if (next.has(group.id)) next.delete(group.id);
                                                            else next.add(group.id);
                                                            return next;
                                                        })
                                                    }
                                                >
                                                    <AppIcon
                                                        name={groupIcons[group.id] ?? 'settings'}
                                                        aria-hidden="true"
                                                    />
                                                    <strong>{group.title}</strong>
                                                    <small>
                                                        {progress.completed} из {progress.total}
                                                    </small>
                                                </button>
                                                {isExpanded && (
                                                    <ul className={styles.caseList}>
                                                        {group.cases.map((item) => (
                                                            <li key={item.id}>
                                                                <button
                                                                    type="button"
                                                                    className={
                                                                        item.id === selected?.id
                                                                            ? styles.activeCase
                                                                            : undefined
                                                                    }
                                                                    aria-current={
                                                                        item.id === selected?.id ? 'true' : undefined
                                                                    }
                                                                    onClick={() => setSelectedId(item.id)}
                                                                >
                                                                    <code>{item.displayCode}</code>
                                                                    <span>{item.title}</span>
                                                                    <em className={styles[item.result.status]}>
                                                                        {acceptanceStatusLabels[item.result.status]}
                                                                    </em>
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </section>
                                        );
                                    })
                                ) : (
                                    <div className={styles.noResults}>
                                        <p>По заданным условиям кейсов нет.</p>
                                        <button
                                            type="button"
                                            className="button outline"
                                            onClick={() => {
                                                setSearch('');
                                                setFilter('all');
                                            }}
                                        >
                                            Сбросить фильтры
                                        </button>
                                    </div>
                                )}
                            </div>
                        </aside>
                        {selected && selectedDraft && (
                            <CaseDetail
                                item={selected}
                                groupTitle={selectedGroupTitle}
                                draft={selectedDraft}
                                pending={workspace.pending}
                                hasFrozenAttempt={workspace.hasFrozenAttempt}
                                onChange={(next) => updateDraft(selected, next)}
                                onPrevious={() => selectAdjacent(-1)}
                                onSave={() => void save(false)}
                                onSaveAndNext={() => void save(true)}
                                onReset={() => void reset()}
                            />
                        )}
                    </div>
                </>
            )}
        </main>
    );
}
