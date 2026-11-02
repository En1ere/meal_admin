import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRuntime } from '../../shared/runtime/index.js';
import { ApiError } from '../../shared/api/client.js';
import { authRoutes, safeReturnTo, type AuthContext } from '../../shared/auth/routes.js';
import { useStaffSession } from '../../entities/staff-session/client.js';
import { AuthShell } from './auth-shell.js';
import { useRequestSignal } from '../../shared/api/use-request-signal.js';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { useAdminStatus } from './unlock-screen.js';
import { UnlockScreen } from './unlock-screen.js';
import { setAdminUnlock } from '../../shared/auth/unlock.js';
import { formatRecoveryCodes, safeOtpAuthUri } from './enrollment-model.js';

const neutralError = (error: unknown) =>
    error instanceof ApiError
        ? error.message
        : 'Не удалось связаться с сервисом. Проверьте подключение и попробуйте снова.';
export function SignIn({ context = 'admin' }: { context?: AuthContext }) {
    const runtime = useRuntime();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const session = useStaffSession(context);
    const status = useAdminStatus();
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [visible, setVisible] = useState(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const inFlight = useRef(false);
    const beginRequest = useRequestSignal();
    const errorRef = useRef<HTMLParagraphElement>(null);
    const returnTo = safeReturnTo(params.get('returnTo'), context);
    useEffect(() => {
        if (session.data?.context === context) void navigate(returnTo, { replace: true });
    }, [session.data, context, navigate, returnTo]);
    useEffect(() => {
        if (error) errorRef.current?.focus();
    }, [error]);
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!runtime.api || inFlight.current) return;
        inFlight.current = true;
        setPending(true);
        setError('');
        const signal = beginRequest();
        try {
            const response = await runtime.api.request(
                'POST /api/v1/admin/auth/login',
                { login, password, context },
                signal,
            );
            signal.throwIfAborted();
            runtime.setMfa({ ...response.data, context, returnTo });
            void navigate(authRoutes[context].mfa);
        } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) setError(neutralError(error));
        } finally {
            setPassword('');
            setPending(false);
            inFlight.current = false;
        }
    }
    if (status.data?.status === 'locked') return <UnlockScreen returnTo={returnTo} />;
    if (status.isError)
        return (
            <AuthShell staff>
                <h1>Не удалось проверить вход</h1>
                <button className="button primary" onClick={() => void status.refetch()}>
                    Повторить
                </button>
            </AuthShell>
        );
    return (
        <AuthShell staff>
            <h1>Вход администратора</h1>
            <p className="auth-subtitle">Для доступа к панели нужна отдельная административная сессия.</p>
            <form onSubmit={(event) => void submit(event)} aria-busy={pending || status.isPending}>
                <label htmlFor="login">Логин</label>
                <input
                    id="login"
                    name="login"
                    type="text"
                    autoComplete="username"
                    required
                    maxLength={30}
                    value={login}
                    onChange={(event) => setLogin(event.target.value)}
                    placeholder="Ваш уникальный логин"
                    disabled={pending || status.isPending}
                />
                <label htmlFor="password">Пароль</label>
                <div className="password-field">
                    <input
                        id="password"
                        name="password"
                        type={visible ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        maxLength={1024}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Введите пароль"
                        disabled={pending || status.isPending}
                    />
                    <button type="button" onClick={() => setVisible(!visible)} aria-pressed={visible}>
                        {visible ? 'Скрыть' : 'Показать'}
                    </button>
                </div>
                {(error || runtime.error) && (
                    <p className="form-error" tabIndex={-1} ref={errorRef} role="alert">
                        {error || runtime.error}
                    </p>
                )}
                {runtime.error && (
                    <button type="button" className="text-button" onClick={() => window.location.reload()}>
                        Повторить подключение
                    </button>
                )}
                <button className="button primary" type="submit" disabled={pending || status.isPending || !runtime.api}>
                    {pending && <ArcInlineLoader label={null} />}
                    {pending ? 'Проверяем…' : status.isPending ? 'Проверяем сохранённый вход…' : 'Продолжить'}
                </button>
            </form>
            <p className="inline-note">Следующий шаг — подтверждение второго фактора.</p>
            {import.meta.env.VITE_API_MODE === 'mock' && (
                <details className="developer-accounts">
                    <summary>Тестовый аккаунт</summary>
                    <p>
                        Пароль: <code>1</code>. Локальные моки не предоставляют доступ к настоящему сервису.
                    </p>
                    <button type="button" disabled={pending} onClick={() => setLogin('admin')}>
                        admin
                    </button>
                </details>
            )}
        </AuthShell>
    );
}

function CopyValueButton({ value, label }: { value: string; label: string }) {
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

    useEffect(() => {
        if (copyState !== 'copied') return;
        const timeout = window.setTimeout(() => setCopyState('idle'), 5000);
        return () => window.clearTimeout(timeout);
    }, [copyState]);

    async function copy() {
        try {
            await navigator.clipboard.writeText(value);
            setCopyState('copied');
        } catch {
            setCopyState('error');
        }
    }

    return (
        <div className="copy-action">
            <button type="button" className="button outline" onClick={() => void copy()}>
                {copyState === 'copied' ? 'Скопировано' : label}
            </button>
            <span className="copy-status" role="status" aria-live="polite" data-state={copyState}>
                {copyState === 'copied'
                    ? 'Скопировано в буфер обмена.'
                    : copyState === 'error'
                      ? 'Не удалось скопировать автоматически. Выделите значение вручную.'
                      : ''}
            </span>
            <span className="clipboard-note">
                Буфер обмена не очищается автоматически. Удалите значение вручную после сохранения.
            </span>
        </div>
    );
}

export function MfaScreen({ context }: { context: 'admin' }) {
    const runtime = useRuntime();
    const navigate = useNavigate();
    const flow = runtime.mfa?.context === context ? runtime.mfa : null;
    const completedReturnTo = useRef(authRoutes[context].home as string);
    const clearMfa = runtime.setMfa;
    const [code, setCode] = useState('');
    const [method, setMethod] = useState<'totp' | 'recovery'>('totp');
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [recovery, setRecovery] = useState<string[] | null>(null);
    const [saved, setSaved] = useState(false);
    const [expired, setExpired] = useState(false);
    const inFlight = useRef(false);
    const beginRequest = useRequestSignal();
    const errorRef = useRef<HTMLParagraphElement>(null);
    const enrollmentUri = flow?.enrollment ? safeOtpAuthUri(flow.enrollment.uri, flow.enrollment.secret) : null;
    useEffect(() => {
        if (!flow) return;
        const timeout = setTimeout(
            () => {
                setExpired(true);
                clearMfa(null);
            },
            Math.max(0, Date.parse(flow.expiresAt) - Date.now()),
        );
        return () => clearTimeout(timeout);
    }, [flow, clearMfa]);
    useEffect(() => {
        if (error) errorRef.current?.focus();
    }, [error]);
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!flow || !runtime.api || inFlight.current) return;
        inFlight.current = true;
        setPending(true);
        setError('');
        const signal = beginRequest();
        try {
            const response = await runtime.api.request(
                'POST /api/v1/admin/auth/mfa/verify',
                {
                    challenge: flow.challenge,
                    code,
                    method,
                },
                signal,
            );
            signal.throwIfAborted();
            setAdminUnlock(response.data.unlockToken);
            runtime.api.invalidate();
            runtime.queryClient.clear();
            runtime.queryClient.setQueryData(['session', 'admin'], response.data.user);
            runtime.broadcast();
            completedReturnTo.current = flow.returnTo;
            runtime.setMfa(null);
            if (response.data.recoveryCodes.length) setRecovery(response.data.recoveryCodes);
            else {
                runtime.setMfa(null);
                void navigate(flow.returnTo, { replace: true });
            }
        } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) setError(neutralError(error));
        } finally {
            setCode('');
            setPending(false);
            inFlight.current = false;
        }
    }
    return (
        <AuthShell staff>
            <h1>{recovery ? 'Сохраните резервные коды' : 'Подтвердите вход'}</h1>
            {recovery ? (
                <>
                    <p className="auth-subtitle">
                        Каждый код работает один раз. Сохраните их в надёжном месте: повторно они не показываются.
                    </p>
                    <ul className="recovery-codes" aria-label="Резервные коды">
                        {recovery.map((value) => (
                            <li key={value}>
                                <code>{value}</code>
                            </li>
                        ))}
                    </ul>
                    <CopyValueButton value={formatRecoveryCodes(recovery)} label="Скопировать коды" />
                    <label className="checkbox-label">
                        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />Я сохранил
                        резервные коды
                    </label>
                    <button
                        className="button primary"
                        disabled={!saved}
                        onClick={() => {
                            const target = completedReturnTo.current;
                            setRecovery(null);
                            runtime.setMfa(null);
                            void navigate(target, { replace: true });
                        }}
                    >
                        Продолжить
                    </button>
                </>
            ) : !flow || expired ? (
                <>
                    <p className="auth-subtitle">
                        Начните вход заново. Проверка не сохраняется после перезагрузки и действует 10 минут.
                    </p>
                    <Link className="button primary" to={authRoutes[context].login}>
                        Вернуться ко входу
                    </Link>
                </>
            ) : (
                <>
                    <p className="auth-subtitle">
                        {flow.enrollment
                            ? 'Добавьте аккаунт в приложение-аутентификатор и введите шестизначный код.'
                            : 'Введите код из приложения или одноразовый резервный код.'}
                    </p>
                    {flow.enrollment && (
                        <section className="enrollment" aria-labelledby="enrollment-title">
                            <h2 id="enrollment-title">Подключите приложение-аутентификатор</h2>
                            <ol>
                                <li>
                                    Откройте Google Authenticator, Microsoft Authenticator, 1Password или другое
                                    TOTP-приложение.
                                </li>
                                <li>Добавьте аккаунт вручную и укажите ключ ниже.</li>
                                <li>Введите появившийся шестизначный код в форму.</li>
                            </ol>
                            <p className="enrollment-label">Ключ для ручной настройки</p>
                            <code>{flow.enrollment.secret}</code>
                            <CopyValueButton value={flow.enrollment.secret} label="Скопировать ключ" />
                            {enrollmentUri && (
                                <a className="button outline authenticator-link" href={enrollmentUri}>
                                    Открыть в приложении-аутентификаторе
                                </a>
                            )}
                            <p className="inline-note">Meal Planner · TOTP · 6 цифр · 30 секунд</p>
                            <p className="inline-note">
                                Не отправляйте ключ другим людям. После подтверждения он больше не будет показан.
                            </p>
                        </section>
                    )}
                    <form onSubmit={(event) => void submit(event)} aria-busy={pending}>
                        <label htmlFor="mfa-code">{method === 'totp' ? 'Код подтверждения' : 'Резервный код'}</label>
                        <input
                            id="mfa-code"
                            value={code}
                            onChange={(e) =>
                                setCode(
                                    method === 'totp' ? e.target.value.replace(/\D/gu, '').slice(0, 6) : e.target.value,
                                )
                            }
                            autoComplete="one-time-code"
                            inputMode={method === 'totp' ? 'numeric' : 'text'}
                            pattern={method === 'totp' ? '[0-9]{6}' : undefined}
                            placeholder={method === 'totp' ? 'Введите код' : 'Введите резервный код'}
                            required
                            minLength={6}
                            maxLength={method === 'totp' ? 6 : 64}
                            disabled={pending}
                        />
                        {error && (
                            <p className="form-error" role="alert" tabIndex={-1} ref={errorRef}>
                                {error}
                            </p>
                        )}
                        <button className="button primary" disabled={pending || !runtime.api}>
                            {pending && <ArcInlineLoader label={null} />}
                            {pending ? 'Проверяем…' : 'Подтвердить'}
                        </button>
                    </form>
                    {!flow.enrollment && (
                        <button
                            className="text-button"
                            disabled={pending}
                            onClick={() => {
                                setMethod(method === 'totp' ? 'recovery' : 'totp');
                                setCode('');
                                setError('');
                            }}
                        >
                            {method === 'totp' ? 'Использовать резервный код' : 'Ввести код из приложения'}
                        </button>
                    )}
                    <p className="inline-note">
                        Если приложение и резервные коды потеряны, потребуется восстановление через поддержку.
                    </p>
                    <Link to={authRoutes[context].login} className="back-link" onClick={() => runtime.setMfa(null)}>
                        Начать вход заново
                    </Link>
                </>
            )}
        </AuthShell>
    );
}
