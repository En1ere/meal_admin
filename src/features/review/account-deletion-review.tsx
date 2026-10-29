import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRuntime } from '../../shared/runtime/index.js';
import { adminRecordKeys } from '../../entities/admin-record/index.js';
import { complianceReviewKeys, isAccountDeletionReviewable } from '../../entities/compliance-review/index.js';
import { ApiError } from '../../shared/api/client.js';
import { CriticalConfirmation } from '../auth/access-client.js';
import { useRequestSignal } from '../../shared/api/use-request-signal.js';

type DeletionDecision = 'approve' | 'reject';
type DeletionReviewCommand = {
    decision: DeletionDecision;
    expectedVersion: number;
    reason: string;
    idempotencyKey: string;
};

const statusLabels: Record<string, string> = {
    requested: 'запрошено',
    retention_wait: 'ожидание срока хранения',
    blocked: 'заблокировано',
    ready: 'готово к финализации',
    cancelled: 'отменено',
    rejected: 'отклонено',
    finalized: 'завершено',
};

export function AccountDeletionReview({ id, version, status }: { id: string; version: number; status: string | null }) {
    const { api } = useRuntime();
    const queryClient = useQueryClient();
    const begin = useRequestSignal();
    const [decision, setDecision] = useState<DeletionDecision>('approve');
    const [reason, setReason] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const retry = useRef<{ intent: string; command: DeletionReviewCommand } | null>(null);
    const [hasFrozenAttempt, setHasFrozenAttempt] = useState(false);
    const reviewable = isAccountDeletionReviewable(status);
    const lock = useRef(false);
    const refresh = () =>
        Promise.all([
            queryClient.invalidateQueries({ queryKey: adminRecordKeys.root }),
            queryClient.invalidateQueries({ queryKey: complianceReviewKeys.root }),
        ]);
    const mutation = useMutation({
        mutationFn: async (command: DeletionReviewCommand) => {
            if (!api) throw new Error('Подключение не готово');
            const signal = begin();
            return (await api.request('POST /api/v1/admin/account-deletions/{id}/review', command, signal, { id }))
                .data;
        },
        onSuccess: async (result) => {
            setConfirmed(false);
            setError('');
            retry.current = null;
            setHasFrozenAttempt(false);
            setMessage(
                result.status === 'rejected'
                    ? 'Запрос отклонён. Решение сохранено в истории.'
                    : 'Проверка подтверждена. Финализация по-прежнему зависит от сроков хранения и блокеров.',
            );
            await refresh();
        },
        onError: async (failure) => {
            setConfirmed(false);
            if (failure instanceof ApiError && (failure.status === 409 || failure.status === 412)) {
                retry.current = null;
                setHasFrozenAttempt(false);
                await refresh();
                setError('Запрос изменился и обновлён. Проверьте актуальный статус перед новым решением.');
                return;
            }
            if (!(failure instanceof ApiError) || failure.status >= 500) {
                await refresh();
                setError(
                    'Исход решения неизвестен. Повторите решение без изменений: будет отправлен тот же ключ операции.',
                );
                return;
            }
            retry.current = null;
            setHasFrozenAttempt(false);
            setError(failure.message);
        },
        onSettled: () => {
            lock.current = false;
        },
    });
    function submit(event: FormEvent) {
        event.preventDefault();
        const normalizedReason = reason.trim();
        if (!reviewable || lock.current || !confirmed || normalizedReason.length < 10) return;
        const intent = JSON.stringify([decision, normalizedReason]);
        if (retry.current && retry.current.intent !== intent) {
            setError('Исход предыдущего решения неизвестен. Сначала повторите его без изменений.');
            return;
        }
        if (!retry.current) {
            retry.current = {
                intent,
                command: {
                    decision,
                    expectedVersion: version,
                    reason: normalizedReason,
                    idempotencyKey: crypto.randomUUID(),
                },
            };
            setHasFrozenAttempt(true);
        }
        lock.current = true;
        setMessage('');
        setError('');
        mutation.mutate(retry.current.command);
    }
    return (
        <section className="sessions-panel">
            <h2>Решение по удалению аккаунта</h2>
            <p>
                Подтверждение не удаляет данные немедленно. Оно разрешает перейти к ожиданию сроков хранения; активные
                блокеры и повторная проверка политики остаются обязательными.
            </p>
            {!reviewable ? (
                <p role="status">
                    Решение недоступно: текущее состояние — «
                    {status == null ? 'не определено' : (statusLabels[status] ?? `неизвестно (${status})`)}». Повторная
                    проверка разрешена только для запрошенного, заблокированного запроса или ожидания срока хранения.
                </p>
            ) : (
                <>
                    <CriticalConfirmation />
                    <form onSubmit={submit}>
                        <label>
                            Решение
                            <select
                                value={decision}
                                disabled={mutation.isPending}
                                onChange={(event) => {
                                    setDecision(event.target.value as DeletionDecision);
                                    setConfirmed(false);
                                    setError('');
                                }}
                            >
                                <option value="approve">Подтвердить проверку</option>
                                <option value="reject">Отклонить запрос</option>
                            </select>
                        </label>
                        <label>
                            Основание решения
                            <textarea
                                required
                                minLength={10}
                                maxLength={1000}
                                value={reason}
                                disabled={mutation.isPending}
                                onChange={(event) => {
                                    setReason(event.target.value);
                                    setConfirmed(false);
                                    setError('');
                                }}
                            />
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={confirmed}
                                disabled={mutation.isPending}
                                onChange={(event) => setConfirmed(event.target.checked)}
                            />
                            Подтверждаю решение и его основание
                        </label>
                        <button
                            className={decision === 'reject' ? 'button outline' : 'button primary'}
                            disabled={mutation.isPending || !confirmed || reason.trim().length < 10}
                        >
                            {mutation.isPending
                                ? 'Сохраняем…'
                                : hasFrozenAttempt
                                  ? 'Повторить решение без изменений'
                                  : decision === 'approve'
                                    ? 'Подтвердить проверку'
                                    : 'Отклонить'}
                        </button>
                    </form>
                </>
            )}
            {reviewable && error && <p role="alert">{error}</p>}
            {message && <p role="status">{message}</p>}
        </section>
    );
}
