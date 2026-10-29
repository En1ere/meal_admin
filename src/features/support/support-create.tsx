import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useRuntime } from '../../shared/runtime/index.js';
import { adminRecordKeys } from '../../entities/admin-record/index.js';
import { ApiError } from '../../shared/api/client.js';
import { useRequestSignal } from '../../shared/api/use-request-signal.js';
import styles from './support.module.css';

export function SupportCreate() {
    const { api, queryClient } = useRuntime();
    const begin = useRequestSignal();
    const [recipient, setRecipient] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
    const lock = useRef(false);

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!api || lock.current) return;
        const fingerprint = JSON.stringify([recipient, subject, body]);
        if (attempt.current && attempt.current.fingerprint !== fingerprint) {
            setError('Повторите прежний запрос для проверки результата.');
            return;
        }
        attempt.current ??= { fingerprint, key: crypto.randomUUID() };
        lock.current = true;
        setBusy(true);
        setError('');
        const signal = begin();
        try {
            const response = await api.request(
                'POST /api/v1/admin/support/create',
                { requesterId: recipient, subject, body, idempotencyKey: attempt.current.key },
                signal,
            );
            signal.throwIfAborted();
            attempt.current = null;
            setResult(response.data.ticketId);
            await queryClient.invalidateQueries({ queryKey: adminRecordKeys.root });
        } catch (caught) {
            if (signal.aborted) return;
            if (caught instanceof ApiError && caught.status < 500) {
                attempt.current = null;
                setError(caught.message);
            } else {
                setError(
                    'Исход создания обращения неизвестен. Повторите прежний запрос без изменений: будет использован тот же ключ операции.',
                );
            }
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }

    return (
        <details className={styles.card}>
            <summary>Начать новое обращение</summary>
            <p>По существующему вопросу продолжите прежнее обращение. Пользователь видит отправителя «Поддержка».</p>
            <form onSubmit={(event) => void submit(event)}>
                <label>
                    UUID пользователя
                    <input
                        required
                        value={recipient}
                        onChange={(event) => setRecipient(event.target.value)}
                        disabled={busy}
                    />
                </label>
                <label>
                    Тема
                    <input
                        required
                        maxLength={200}
                        value={subject}
                        onChange={(event) => setSubject(event.target.value)}
                        disabled={busy}
                    />
                </label>
                <label>
                    Сообщение
                    <textarea
                        className={styles['message-input']}
                        required
                        maxLength={10000}
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        disabled={busy}
                    />
                </label>
                <button className="button primary" disabled={busy}>
                    {busy ? 'Создаём…' : 'Создать обращение'}
                </button>
            </form>
            {error && <p role="alert">{error}</p>}
            {result && (
                <p role="status">
                    <Link to={`/admin/support/${result}`}>Открыть созданное обращение</Link>
                </p>
            )}
        </details>
    );
}
