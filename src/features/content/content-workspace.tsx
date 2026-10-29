import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminRecordKeys } from '../../entities/admin-record/index.js';
import {
    contentActionAvailable,
    contentCommandIntent,
    contentForbiddenRecovery,
    contentReviewStatusLabel,
    contentWorkflowKeys,
    isContentMutatingCommand,
    type ContentCommand,
    type ContentCompare,
    type ContentMutatingCommand,
    type ContentResult,
    type ContentSection,
} from '../../entities/content-workflow/index.js';
import { useStaffSession } from '../../entities/staff-session/client.js';
import { ApiError } from '../../shared/api/client.js';
import { adminAuthStatusKey, CriticalConfirmation, useAdminStatus } from '../auth/access-client.js';
import { useRequestSignal } from '../../shared/api/use-request-signal.js';
import styles from './content-workspace.module.css';

export type ContentApi = (command: ContentCommand, signal?: AbortSignal) => Promise<ContentResult>;
export function ContentWorkspace({
    section,
    id,
    api,
}: {
    section: ContentSection;
    id: string;
    api: ContentApi | null;
}) {
    const cache = useQueryClient();
    const session = useStaffSession('admin');
    const adminStatus = useAdminStatus();
    const [now, setNow] = useState(Date.now);
    const criticalConfirmed = !!adminStatus.data?.criticalUntil && Date.parse(adminStatus.data.criticalUntil) > now;
    useEffect(() => {
        const until = adminStatus.data?.criticalUntil;
        if (!until) return;
        const expiresAt = Date.parse(until);
        const delay = Math.max(0, Math.min(expiresAt - Date.now() + 25, 2_147_483_647));
        const timer = setTimeout(() => setNow(expiresAt + 1), delay);
        return () => clearTimeout(timer);
    }, [adminStatus.data?.criticalUntil]);
    const sessionId = session.data?.sessionId;
    const key = contentWorkflowKeys.workspace(sessionId, section, id);
    const [hasFrozenAttempt, setHasFrozenAttempt] = useState(false);
    const [retryRequiresCritical, setRetryRequiresCritical] = useState(false);
    const query = useQuery({
        queryKey: key,
        enabled: !!api && !!sessionId,
        queryFn: ({ signal }) => {
            if (!api) throw new Error('Подключение не готово');
            return api({ action: 'load' }, signal);
        },
        refetchInterval: hasFrozenAttempt ? false : 60000,
        refetchOnWindowFocus: !hasFrozenAttempt,
    });
    const [internalReason, setInternalReason] = useState('');
    const [publicReason, setPublicReason] = useState('');
    const [second, setSecond] = useState('');
    const [canonical, setCanonical] = useState(id);
    const [choices, setChoices] = useState<Record<string, 'left' | 'right'>>({});
    const [preview, setPreview] = useState<ContentResult['comparison']>(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const busy = useRef(false);
    const retry = useRef<{ intent: string; command: ContentMutatingCommand } | null>(null);
    const beginRequest = useRequestSignal();
    async function run(command: ContentCommand) {
        if (busy.current) return;
        const mutating = isContentMutatingCommand(command);
        if (!mutating && retry.current) {
            setError('Исход предыдущей команды неизвестен. Сначала повторите её без изменений.');
            return;
        }
        if (isContentMutatingCommand(command)) {
            const intent = contentCommandIntent(command);
            if (retry.current && retry.current.intent !== intent) {
                setError('Исход предыдущей команды неизвестен. Сначала повторите её без изменений.');
                return;
            }
            const attempt = retry.current ?? { intent, command };
            if (!retry.current) {
                retry.current = attempt;
                setHasFrozenAttempt(true);
                setRetryRequiresCritical(command.action === 'moderate' || command.action === 'merge');
            }
            command = attempt.command;
        }
        busy.current = true;
        setPending(true);
        setError('');
        setMessage('');
        const signal = beginRequest();
        try {
            if (!api) throw new Error('Подключение не готово');
            const result = await api(command, signal);
            signal.throwIfAborted();
            cache.setQueryData(key, result);
            setPreview(result.comparison);
            setMessage(
                result.message || (command.action === 'compare' ? 'Предпросмотр обновлён.' : 'Решение сохранено.'),
            );
            retry.current = null;
            setHasFrozenAttempt(false);
            setRetryRequiresCritical(false);
            if (mutating) await cache.invalidateQueries({ queryKey: adminRecordKeys.root });
        } catch (failure) {
            if (signal.aborted) return;
            if (failure instanceof ApiError && (failure.status === 409 || failure.status === 412)) {
                retry.current = null;
                setHasFrozenAttempt(false);
                setRetryRequiresCritical(false);
                setPreview(null);
                await Promise.all([
                    cache.invalidateQueries({ queryKey: contentWorkflowKeys.workspace(sessionId, section, id) }),
                    cache.invalidateQueries({ queryKey: adminRecordKeys.root }),
                ]);
                setError(
                    'Данные изменились и обновлены. Проверьте актуальные версии и подготовьте новый предпросмотр.',
                );
                return;
            }
            if (mutating && (!(failure instanceof ApiError) || failure.status >= 500)) {
                await cache.invalidateQueries({ queryKey: contentWorkflowKeys.workspace(sessionId, section, id) });
                setError(
                    'Исход команды неизвестен. Повторите её без изменений: будет отправлен тот же полный запрос и ключ.',
                );
                return;
            }
            if (mutating && failure instanceof ApiError && failure.status === 403) {
                await cache.invalidateQueries({ queryKey: adminAuthStatusKey });
                const status = cache.getQueryData<{ criticalUntil?: string | null } | null>(adminAuthStatusKey);
                setError(
                    contentForbiddenRecovery(status?.criticalUntil) === 'reconfirm'
                        ? 'Критичное подтверждение отсутствует или истекло. Подтвердите действия и повторите прежнюю команду: полный запрос и ключ сохранены.'
                        : 'Операция запрещена текущей ролью или разрешениями. Критичное подтверждение активно, поэтому повторный TOTP не поможет. Исходная команда и ключ сохранены на этом экране: после восстановления доступа выполните точный повтор либо обновите данные и выйдите из процесса.',
                );
                return;
            }
            if (mutating && failure instanceof ApiError && failure.status === 401) {
                setError(
                    'Служебная сессия отклонена. Пройдите восстановление доступа и перечитайте актуальные данные; после размонтирования экрана оператор должен проверить исход команды перед новым действием.',
                );
                return;
            }
            if (mutating) {
                retry.current = null;
                setHasFrozenAttempt(false);
                setRetryRequiresCritical(false);
            }
            setError(failure instanceof Error ? failure.message : 'Не удалось выполнить действие.');
        } finally {
            busy.current = false;
            setPending(false);
        }
    }
    const data = query.data;
    if (query.isPending) return <p role="status">Загрузка материала и версий…</p>;
    if (query.isError || !data)
        return (
            <p role="alert">
                Не удалось получить материал.{' '}
                <button className="button outline" onClick={() => void query.refetch()}>
                    Повторить
                </button>
            </p>
        );
    const left = data.cards.find((card) => card.id === id);
    const right = data.cards.find((card) => card.id === second);
    const compare: ContentCompare | null =
        left && right
            ? {
                  leftId: left.id,
                  rightId: right.id,
                  leftVersion: left.version,
                  rightVersion: right.version,
                  canonicalId: canonical,
                  choices,
              }
            : null;
    return (
        <section className={styles.workspace} aria-busy={pending}>
            <h2>{section === 'queues' ? 'Проверка версии материала' : 'Сравнение и объединение дублей'}</h2>
            {error && (
                <p role="alert">
                    {error}{' '}
                    {hasFrozenAttempt && (
                        <button
                            className="button outline"
                            disabled={pending || (retryRequiresCritical && !criticalConfirmed)}
                            onClick={() => retry.current && void run(retry.current.command)}
                        >
                            Повторить прежнюю команду
                        </button>
                    )}{' '}
                    <button
                        className="button outline"
                        disabled={pending}
                        onClick={() => {
                            setPreview(null);
                            void query.refetch();
                        }}
                    >
                        Обновить данные
                    </button>
                </p>
            )}
            {message && <p role="status">{message}</p>}
            {section === 'queues' ? (
                <>
                    <p>
                        <strong>Статус проверки:</strong>{' '}
                        {data.review
                            ? contentReviewStatusLabel(data.review.status)
                            : contentReviewStatusLabel(data.status)}
                        . Старая публикация и текущая редакция на проверке могут быть разными.
                    </p>
                    <div className={styles.columns}>
                        {(
                            [
                                [
                                    data.publication?.revision ?? data.current,
                                    'Активная публичная редакция',
                                    'publication',
                                ],
                                [data.review?.revision ?? data.pending, 'Редакция текущей проверки', 'review'],
                            ] as const
                        ).map(([revision, title, axis]) => (
                            <article key={axis}>
                                <h3>{title}</h3>
                                {revision ? (
                                    <>
                                        <p>
                                            Редакция {revision.version} · ID {revision.id}
                                        </p>
                                        <dl>
                                            {Object.entries(revision.fields).map(([name, value]) => (
                                                <div key={name}>
                                                    <dt>{name}</dt>
                                                    <dd>{value ?? 'Не указано'}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </>
                                ) : (
                                    <p>
                                        {axis === 'publication'
                                            ? 'Активной публичной редакции нет.'
                                            : 'Редакция проверки недоступна.'}
                                    </p>
                                )}
                                {axis === 'publication' && data.publication && (
                                    <p>Опубликовано {new Date(data.publication.publishedAt).toLocaleString('ru-RU')}</p>
                                )}
                                {axis === 'review' && data.review?.publicReason && (
                                    <p>
                                        <strong>Причина для автора:</strong> {data.review.publicReason}
                                    </p>
                                )}
                            </article>
                        ))}
                    </div>
                    <p>
                        Full admin «Одобрить» сразу публикует редакцию. Отклонение новой редакции не снимает старую
                        публикацию. «Скрыть» скрывает рецепт целиком; «Снять с публикации» не запрещает автору
                        редактирование.
                    </p>
                    <label>
                        Внутренний комментарий
                        <textarea
                            value={internalReason}
                            maxLength={2000}
                            disabled={pending}
                            aria-describedby="internal-reason-help"
                            onChange={(e) => setInternalReason(e.target.value)}
                        />
                    </label>
                    <p id="internal-reason-help">Виден только сотрудникам и не передаётся автору.</p>
                    <label>
                        Причина для автора
                        <textarea
                            value={publicReason}
                            minLength={3}
                            maxLength={500}
                            disabled={pending}
                            aria-describedby="public-reason-help"
                            onChange={(e) => setPublicReason(e.target.value)}
                        />
                    </label>
                    <p id="public-reason-help">
                        Автор увидит только этот санитизированный текст. Внутренний комментарий не раскрывается.
                    </p>
                    <CriticalConfirmation />
                    <div className={styles.actions}>
                        {(['approve', 'reject', 'hide', 'unpublish'] as const).map((action) => (
                            <button
                                className="button outline"
                                key={action}
                                disabled={
                                    pending ||
                                    !criticalConfirmed ||
                                    (action !== 'approve' &&
                                        (!internalReason.trim() || publicReason.trim().length < 3)) ||
                                    (!hasFrozenAttempt && !contentActionAvailable(data, action))
                                }
                                onClick={() =>
                                    void run({
                                        action: 'moderate',
                                        data: {
                                            action,
                                            version: data.version,
                                            reason: internalReason,
                                            publicReason: action === 'approve' ? null : publicReason,
                                            idempotencyKey: crypto.randomUUID(),
                                        },
                                    })
                                }
                            >
                                {
                                    {
                                        approve: 'Одобрить и опубликовать',
                                        reject: 'Отклонить с причиной',
                                        hide: 'Скрыть публично',
                                        unpublish: 'Снять с публикации',
                                    }[action]
                                }
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                <>
                    {left?.aliasOf ? (
                        <p>Эта карточка объединена с {left.aliasOf}. Старый идентификатор продолжает работать.</p>
                    ) : (
                        <>
                            <label>
                                Кандидат для сравнения
                                <select
                                    value={second}
                                    disabled={pending}
                                    onChange={(e) => {
                                        setSecond(e.target.value);
                                        setCanonical(id);
                                        setChoices({});
                                        setPreview(null);
                                    }}
                                >
                                    <option value="">Выберите карточку</option>
                                    {data.cards
                                        .filter((card) => card.id !== id && !card.aliasOf)
                                        .map((card) => (
                                            <option key={card.id} value={card.id}>
                                                {card.name}
                                            </option>
                                        ))}
                                </select>
                            </label>
                            <label>
                                Основная карточка
                                <select
                                    value={canonical}
                                    disabled={pending || !right}
                                    onChange={(e) => {
                                        setCanonical(e.target.value);
                                        setPreview(null);
                                    }}
                                >
                                    <option value={id}>{left?.name ?? id}</option>
                                    {right && <option value={right.id}>{right.name}</option>}
                                </select>
                            </label>
                            {left && right && (
                                <div className={styles.table}>
                                    <table>
                                        <caption>Явное разрешение каждого различия</caption>
                                        <thead>
                                            <tr>
                                                <th>Поле</th>
                                                <th>Текущая карточка</th>
                                                <th>Кандидат</th>
                                                <th>Итог</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.keys(left.fields).map((field) => (
                                                <tr key={field}>
                                                    <th>{field}</th>
                                                    <td>{left.fields[field] ?? 'Не указано'}</td>
                                                    <td>{right.fields[field] ?? 'Не указано'}</td>
                                                    <td>
                                                        {left.fields[field] === right.fields[field] ? (
                                                            'Совпадает'
                                                        ) : (
                                                            <select
                                                                aria-label={`Итог поля ${field}`}
                                                                value={choices[field] ?? ''}
                                                                disabled={pending}
                                                                onChange={(e) => {
                                                                    setChoices({
                                                                        ...choices,
                                                                        [field]: e.target.value as 'left' | 'right',
                                                                    });
                                                                    setPreview(null);
                                                                }}
                                                            >
                                                                <option value="">Разрешите конфликт</option>
                                                                <option value="left">Текущая карточка</option>
                                                                <option value="right">Кандидат</option>
                                                            </select>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <p>
                                Фасовки сохранятся отдельными вариантами. Прошлое питание, покупки и расходы не
                                пересчитываются. Старые ID сохраняются как ссылки.
                            </p>
                            <button
                                className="button outline"
                                disabled={pending || !compare || hasFrozenAttempt}
                                onClick={() => compare && void run({ action: 'compare', data: compare })}
                            >
                                Предпросмотр объединения
                            </button>
                            {preview && (
                                <article>
                                    <h3>Итог и последствия</h3>
                                    {preview.blockedReason && <p role="alert">{preview.blockedReason}</p>}
                                    <dl>
                                        {Object.entries(preview.resolved).map(([field, value]) => (
                                            <div key={field}>
                                                <dt>{field}</dt>
                                                <dd>{value ?? 'Не указано'}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                    <p>
                                        Основной ID: {preview.canonicalId}. Вариантов фасовки:{' '}
                                        {new Set([...preview.left.variants, ...preview.right.variants]).size}. Источники
                                        и авторство сохраняются.
                                    </p>
                                    {preview.conflicts.some((field) => !choices[field]) && (
                                        <p>Выберите итог для каждого конфликта.</p>
                                    )}
                                </article>
                            )}
                            <label>
                                Причина действия
                                <textarea
                                    maxLength={2000}
                                    value={internalReason}
                                    disabled={pending}
                                    onChange={(e) => setInternalReason(e.target.value)}
                                />
                            </label>
                            <CriticalConfirmation />
                            <div className={styles.actions}>
                                <button
                                    className="button outline"
                                    disabled={
                                        pending ||
                                        !criticalConfirmed ||
                                        !compare ||
                                        (!hasFrozenAttempt &&
                                            (!preview ||
                                                !!preview.blockedReason ||
                                                preview.conflicts.some((field) => !choices[field]))) ||
                                        !internalReason.trim()
                                    }
                                    onClick={() =>
                                        compare &&
                                        preview &&
                                        void run({
                                            action: 'merge',
                                            data: {
                                                ...compare,
                                                previewKey: preview.previewKey,
                                                reason: internalReason,
                                                idempotencyKey: crypto.randomUUID(),
                                            },
                                        })
                                    }
                                >
                                    Подтвердить объединение
                                </button>
                                <button
                                    className="button outline"
                                    disabled={pending || !compare || !internalReason.trim()}
                                    onClick={() =>
                                        compare &&
                                        void run({
                                            action: 'not-duplicate',
                                            data: {
                                                leftId: compare.leftId,
                                                rightId: compare.rightId,
                                                leftVersion: compare.leftVersion,
                                                rightVersion: compare.rightVersion,
                                                reason: internalReason,
                                                idempotencyKey: crypto.randomUUID(),
                                            },
                                        })
                                    }
                                >
                                    Это не дубли
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}
            <details>
                <summary>Внутренняя история решений ({data.history.length})</summary>
                <p>Служебные комментарии ниже доступны только сотрудникам и не показываются автору.</p>
                {data.history.map((entry, index) => (
                    <article key={index}>
                        <p>
                            {entry.action} · {new Date(entry.at).toLocaleString('ru-RU')}
                        </p>
                        <p>
                            {entry.reason || 'Без дополнительного комментария'} · {entry.actor}
                        </p>
                    </article>
                ))}
            </details>
        </section>
    );
}
