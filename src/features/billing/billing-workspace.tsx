import { useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../shared/runtime/index.js';
import { adminRecordKeys } from '../../entities/admin-record/index.js';
import {
    availableRefundMinor,
    billingAccountKeys,
    deriveBillingCapabilities,
    formatRublesFromMinor,
} from '../../entities/billing-account/index.js';
import { useStaffSession } from '../../entities/staff-session/client.js';
import { ApiError } from '../../shared/api/client.js';
import { CriticalConfirmation } from '../auth/access-client.js';
import { useRequestSignal } from '../../shared/api/use-request-signal.js';
import { Skeleton as ArcSkeleton } from '@meal-planner/design-system';
export function BillingWorkspace({ section, id }: { section: 'users' | 'subscriptions' | 'payments'; id: string }) {
    const { api, queryClient } = useRuntime();
    const session = useStaffSession('admin');
    const sessionId = session.data?.sessionId;
    const begin = useRequestSignal();
    const [action, setAction] = useState(section === 'payments' ? 'refund' : section === 'users' ? 'grant' : 'extend');
    const [plan, setPlan] = useState('plus');
    const [until, setUntil] = useState('');
    const [target, setTarget] = useState('');
    const [amount, setAmount] = useState('');
    const [effect, setEffect] = useState('preserve');
    const [reason, setReason] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [accessConfirmed, setAccessConfirmed] = useState(false);
    const [preview, setPreview] = useState('');
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState('');
    const lock = useRef(false);
    const attempt = useRef<{ key: string; fingerprint: string; version: string } | null>(null);
    const query = useQuery({
        queryKey: billingAccountKeys.workspace(sessionId, section, id),
        enabled: !!api && !!sessionId,
        queryFn: async ({ signal }) => {
            if (!api) throw new Error('Подключение не готово');
            return (await api.request('GET /api/v1/admin/billing/{section}/{id}', undefined, signal, { section, id }))
                .data;
        },
    });
    const fingerprint = JSON.stringify([action, plan, until, target, amount, effect, reason]);
    const previewFingerprint = JSON.stringify([fingerprint, query.data?.version]);
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!api || !query.data || lock.current) return;
        if (preview !== previewFingerprint) {
            setPreview(previewFingerprint);
            setConfirmed(false);
            setAccessConfirmed(false);
            return;
        }
        if (!confirmed || (action === 'refund' && effect === 'terminate' && !accessConfirmed)) return;
        if (action === 'refund') {
            setFeedback('Возврат недоступен до подключения платёжного провайдера и сверки операций.');
            return;
        }
        if (attempt.current && attempt.current.fingerprint !== fingerprint) {
            setFeedback('Повторите прежнюю операцию: результат неизвестен.');
            return;
        }
        attempt.current ??= { key: crypto.randomUUID(), fingerprint, version: query.data.version };
        lock.current = true;
        setBusy(true);
        const signal = begin();
        try {
            const result = await api.request(
                'POST /api/v1/admin/billing/{section}/{id}',
                {
                    version: attempt.current.version,
                    idempotencyKey: attempt.current.key,
                    action,
                    plan,
                    until: until ? new Date(until).toISOString() : null,
                    targetId: action === 'refund' ? (query.data.payment?.targetId ?? null) : target || null,
                    amountMinor: action === 'refund' ? amount : null,
                    effect,
                    reason,
                    confirmed: true,
                    accessConfirmed,
                },
                signal,
                { section, id },
            );
            signal.throwIfAborted();
            attempt.current = null;
            setPreview('');
            setConfirmed(false);
            setFeedback(
                result.data.status === 'unknown'
                    ? 'Результат провайдера неизвестен. Сумма зарезервирована; повторный возврат этой суммы запрещён до сверки.'
                    : 'Тестовая операция сохранена. Реальные деньги не перемещались.',
            );
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: billingAccountKeys.workspace(sessionId, section, id) }),
                queryClient.invalidateQueries({ queryKey: adminRecordKeys.root }),
            ]);
        } catch (error) {
            if (signal.aborted) return;
            if (error instanceof ApiError && error.status < 500) {
                attempt.current = null;
                if (error.status === 409) {
                    setPreview('');
                    setConfirmed(false);
                    setAccessConfirmed(false);
                    await Promise.all([
                        queryClient.invalidateQueries({
                            queryKey: billingAccountKeys.workspace(sessionId, section, id),
                        }),
                        queryClient.invalidateQueries({ queryKey: adminRecordKeys.root }),
                    ]);
                    setFeedback('Финансовые данные изменились и обновлены. Проверьте последствия заново.');
                    return;
                }
            }
            setFeedback(
                error instanceof ApiError && error.status < 500
                    ? error.message
                    : 'Исход финансовой операции неизвестен. Повторите прежнюю операцию без изменений: будет использован тот же ключ операции.',
            );
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    if (query.isPending) return <ArcSkeleton variant="lines" lines={3} label="Загружаем финансовые данные…" />;
    if (query.isError)
        return (
            <section className="sessions-panel">
                <p role="alert">{query.error.message}</p>
                <button className="button outline" onClick={() => void query.refetch()}>
                    Повторить
                </button>
            </section>
        );
    const data = query.data;
    const payment = data.payment;
    const capabilities = deriveBillingCapabilities(data);
    const refund = payment ? availableRefundMinor(payment) : null;
    const actionUnavailable =
        (action === 'grant' && !capabilities.canGrant) ||
        (action === 'extend' && !capabilities.canExtend) ||
        (action === 'freeze' && !capabilities.canFreeze) ||
        (action === 'unfreeze' && !capabilities.canUnfreeze) ||
        (action === 'revokeGift' && !capabilities.canRevokeGift);
    return (
        <section className="sessions-panel">
            <h2>Подписки и возвраты</h2>
            <p>{data.notice}</p>
            <p>
                Владелец: {data.ownerId}. Тариф: {data.plan}. {data.frozen ? 'Заморожен' : 'Не заморожен'}. Остаток ИИ:{' '}
                {data.quota}.
            </p>
            {data.refreshAt && (
                <p>
                    Обновление квоты: {new Date(data.refreshAt).toLocaleString()}
                    {data.frozen ? ' (отсчёт приостановлен)' : ''}
                </p>
            )}
            <h3>Периоды доступа</h3>
            {data.periods.length ? (
                data.periods.map((p) => (
                    <p key={p.id}>
                        {p.source === 'paid' ? 'Оплачено' : 'Административный подарок'} ·{' '}
                        {new Date(p.startsAt).toLocaleString()} — {new Date(p.endsAt).toLocaleString()} ·{' '}
                        {p.revoked ? 'Отозван' : 'Сохранён'} · {p.id}
                    </p>
                ))
            ) : (
                <p>Периодов нет.</p>
            )}
            {payment && (
                <p>
                    Платёж: {payment.status}. Оплачено {formatRublesFromMinor(payment.paidMinor)}, возвращено{' '}
                    {formatRublesFromMinor(payment.returnedMinor)}, зарезервировано{' '}
                    {formatRublesFromMinor(payment.reservedMinor)}. Доступно к возврату{' '}
                    {refund?.availableMinor === null || refund?.availableMinor === undefined
                        ? 'не определено'
                        : formatRublesFromMinor(refund.availableMinor)}
                    . Исходный плательщик: {data.payerId ?? 'не указан'}. Объект: {payment.targetId}
                    {payment.targetKind === 'package' ? `, остаток пакета: ${payment.packageRemaining}` : ''}.
                </p>
            )}
            {payment && !refund?.isConsistent && (
                <p role="alert">
                    Ledger платежа неконсистентен. Возврат заблокирован до сверки оплаченной, возвращённой и
                    зарезервированной сумм.
                </p>
            )}
            {section === 'payments' && (
                <p role="note">
                    Можно проверить последствия возврата, но выполнить его нельзя до подключения платёжного провайдера и
                    механизма сверки.
                </p>
            )}
            <CriticalConfirmation />
            <form onSubmit={(e) => void submit(e)}>
                <label>
                    Действие
                    <select value={action} onChange={(e) => setAction(e.target.value)} disabled={busy}>
                        {section === 'payments' ? (
                            <option value="refund">Возврат</option>
                        ) : (
                            <>
                                {section === 'users' && (
                                    <option value="grant" disabled={!capabilities.canGrant}>
                                        Бесплатно выдать
                                    </option>
                                )}
                                <option value="extend" disabled={!capabilities.canExtend}>
                                    Добавить бесплатный период
                                </option>
                                <option value="revokeGift" disabled={!capabilities.canRevokeGift}>
                                    Отозвать только подарок
                                </option>
                                <option value="freeze" disabled={!capabilities.canFreeze}>
                                    Заморозить
                                </option>
                                <option value="unfreeze" disabled={!capabilities.canUnfreeze}>
                                    Разморозить
                                </option>
                            </>
                        )}
                    </select>
                </label>
                {action === 'grant' && (
                    <label>
                        Тариф
                        <select value={plan} onChange={(e) => setPlan(e.target.value)} disabled={busy}>
                            <option value="plus">Plus</option>
                            <option value="pro">Pro</option>
                        </select>
                    </label>
                )}
                {action === 'grant' && !capabilities.canGrant && (
                    <p role="note">
                        У пользователя уже есть активный или замороженный период. Используйте продление либо управление
                        существующей подпиской.
                    </p>
                )}
                {action !== 'grant' && actionUnavailable && section !== 'payments' && (
                    <p role="note">Это действие недоступно для текущего состояния подписки.</p>
                )}
                {(action === 'grant' || action === 'extend') && (
                    <label>
                        Новая дата окончания (местное время)
                        <input
                            type="datetime-local"
                            required
                            value={until}
                            onChange={(e) => setUntil(e.target.value)}
                            disabled={busy}
                        />
                    </label>
                )}
                {action === 'revokeGift' && (
                    <label>
                        Подарочный период
                        <select value={target} required onChange={(e) => setTarget(e.target.value)} disabled={busy}>
                            <option value="">Выберите период</option>
                            {data.periods
                                .filter((p) => p.source === 'gift' && !p.revoked)
                                .map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {new Date(p.startsAt).toLocaleString()} — {new Date(p.endsAt).toLocaleString()}
                                    </option>
                                ))}
                        </select>
                    </label>
                )}
                {action === 'refund' && (
                    <>
                        <label>
                            Сумма в копейках
                            <input
                                inputMode="numeric"
                                pattern="[1-9][0-9]*"
                                maxLength={16}
                                required
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                disabled={busy}
                            />
                        </label>
                        <label>
                            Доступ после возврата
                            <select value={effect} onChange={(e) => setEffect(e.target.value)} disabled={busy}>
                                <option value="preserve">Сохранить доступ</option>
                                <option value="terminate">Прекратить выбранный период / пакет</option>
                            </select>
                        </label>
                    </>
                )}
                <label>
                    Причина
                    <textarea
                        required
                        maxLength={5000}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        disabled={busy}
                    />
                </label>
                {preview === previewFingerprint && (
                    <div role="region" aria-label="Последствия финансовой операции">
                        <h3>Проверка последствий</h3>
                        <p>Причина: {reason}</p>
                        {action === 'refund' ? (
                            <>
                                <p>
                                    Возврат {/^\d+$/.test(amount) ? formatRublesFromMinor(amount) : '—'} исходному
                                    плательщику {data.payerId ?? 'не указан'}. Текущий владелец: {data.ownerId}. Объект:{' '}
                                    {payment?.targetId}.
                                </p>
                                {effect === 'terminate' ? (
                                    <>
                                        <p>
                                            {payment?.targetKind === 'package'
                                                ? 'Будет отменён только неизрасходованный остаток; использованные действия не становятся долгом.'
                                                : 'Будет отменён весь остаток именно выбранного периода независимо от суммы возврата. Другие периоды сохраняются.'}{' '}
                                            Семья потеряет покрытие этого периода. Уведомления семье требуют подключения
                                            доставки.
                                        </p>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={accessConfirmed}
                                                onChange={(e) => setAccessConfirmed(e.target.checked)}
                                                disabled={busy}
                                            />
                                            Отдельно подтверждаю прекращение указанного доступа
                                        </label>
                                    </>
                                ) : (
                                    <p>Доступ остаётся без изменений.</p>
                                )}
                            </>
                        ) : (
                            <p>
                                {action === 'revokeGift'
                                    ? 'Отзывается только выбранный подарочный период. Оплаченные периоды сохраняются.'
                                    : action === 'freeze' || action === 'unfreeze'
                                      ? 'Остаток срока и текущей квоты сохраняется; пропущенные квоты не начисляются.'
                                      : 'Бесплатный срок учитывается отдельно; автопродление не включается, фиктивного платежа нет.'}
                            </p>
                        )}
                        <label>
                            <input
                                type="checkbox"
                                checked={confirmed}
                                onChange={(e) => setConfirmed(e.target.checked)}
                                disabled={busy}
                            />
                            Подтверждаю операцию
                        </label>
                    </div>
                )}
                <button
                    className="button primary"
                    disabled={
                        busy ||
                        actionUnavailable ||
                        (payment?.status !== 'paid' && section === 'payments') ||
                        (section === 'payments' && !refund?.isConsistent) ||
                        (action === 'refund' && preview === previewFingerprint) ||
                        (preview === previewFingerprint &&
                            (!confirmed || (action === 'refund' && effect === 'terminate' && !accessConfirmed)))
                    }
                >
                    {busy ? 'Выполняем…' : preview === previewFingerprint ? 'Выполнить' : 'Проверить последствия'}
                </button>
            </form>
            {feedback && <p role="status">{feedback}</p>}
            <h3>История</h3>
            {data.history.length ? (
                data.history.map((h, i) => (
                    <p key={i}>
                        {new Date(h.at).toLocaleString()} · {h.action}: {h.reason}
                    </p>
                ))
            ) : (
                <p>Операций пока нет.</p>
            )}
        </section>
    );
}
