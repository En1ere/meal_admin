import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { ApiError } from '../api/client.js';
import { useRequestSignal } from '../api/use-request-signal.js';
import { useRuntime } from '../runtime/index.js';
import { useAdminStatus } from './admin-status.js';
import styles from './critical-confirmation.module.css';

export function CriticalConfirmation() {
    const codeId = useId();
    const runtime = useRuntime();
    const status = useAdminStatus();
    const [now, setNow] = useState(Date.now);
    const [code, setCode] = useState('');
    const [method, setMethod] = useState<'totp' | 'recovery'>('totp');
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const locked = useRef(false);
    const beginRequest = useRequestSignal();
    const until = status.data?.criticalUntil;
    const confirmed = !!until && Date.parse(until) > now;
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!runtime.api || locked.current) return;
        locked.current = true;
        setPending(true);
        setError('');
        const signal = beginRequest();
        try {
            await runtime.api.request('POST /api/v1/admin/auth/critical-confirm', { code, method }, signal);
            signal.throwIfAborted();
            await status.refetch();
            setNow(Date.now());
        } catch (failure) {
            if (signal.aborted) return;
            setError(
                failure instanceof ApiError ? failure.message : 'Не удалось подтвердить действия. Повторите попытку.',
            );
            if (failure instanceof ApiError && failure.status === 401) {
                const latest = await status.refetch();
                if (latest.data === null) {
                    runtime.reset();
                    runtime.broadcast();
                }
            }
        } finally {
            setCode('');
            setPending(false);
            locked.current = false;
        }
    }
    return (
        <section className="sessions-panel">
            <h2>Подтверждение критичных действий</h2>
            <p>Публикация, модерация, блокировки и другие критичные команды требуют свежего подтверждения.</p>
            {status.isPending ? (
                <p role="status">Проверяем подтверждение…</p>
            ) : status.isError ? (
                <p role="alert">
                    Не удалось проверить подтверждение.{' '}
                    <button className="text-button" onClick={() => void status.refetch()}>
                        Повторить
                    </button>
                </p>
            ) : confirmed ? (
                <p role="status">
                    Действия подтверждены до {new Date(until).toLocaleTimeString('ru-RU')}. Окно действует только в
                    текущей сессии.
                </p>
            ) : (
                <>
                    <p>Введите код для нескольких критичных действий в течение 30 минут. Пароль не требуется.</p>
                    <form className={styles.form} onSubmit={(event) => void submit(event)} aria-busy={pending}>
                        <label htmlFor={codeId}>
                            {method === 'totp' ? 'Код подтверждения из приложения' : 'Резервный код подтверждения'}
                        </label>
                        <input
                            id={codeId}
                            value={code}
                            onChange={(event) => setCode(event.target.value)}
                            required
                            autoComplete="one-time-code"
                            inputMode={method === 'totp' ? 'numeric' : 'text'}
                            minLength={6}
                            maxLength={method === 'totp' ? 6 : 64}
                            disabled={pending}
                        />
                        <button className="button primary" disabled={pending || !runtime.api}>
                            {pending && <ArcInlineLoader label={null} />}Подтвердить критичные действия
                        </button>
                    </form>
                    <button
                        className={`text-button ${styles.alternate}`}
                        disabled={pending}
                        onClick={() => {
                            setMethod(method === 'totp' ? 'recovery' : 'totp');
                            setCode('');
                            setError('');
                        }}
                    >
                        {method === 'totp' ? 'Подтвердить резервным кодом' : 'Подтвердить кодом приложения'}
                    </button>
                </>
            )}
            {error && (
                <p className="form-error" role="alert">
                    {error}
                </p>
            )}
        </section>
    );
}
