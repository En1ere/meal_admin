import { useEffect, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PageLoader as ArcPageLoader } from '@meal-planner/design-system';
import { useStaffSession } from '../../entities/staff-session/client.js';
import { authRoutes, safeReturnTo, type AuthContext } from '../../shared/auth/routes.js';
import { useRuntime } from '../../shared/runtime/index.js';

export function SessionGuard({ context, children }: { context: AuthContext; children?: ReactNode }) {
    const runtime = useRuntime();
    const session = useStaffSession(context);
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const accepted = session.data?.context === context;
    useEffect(() => {
        if (session.isSuccess && !accepted)
            void navigate(
                `${authRoutes[context].login}?returnTo=${encodeURIComponent(safeReturnTo(pathname, context))}`,
                { replace: true },
            );
    }, [session.isSuccess, accepted, context, navigate, pathname]);
    if (runtime.error || session.isError)
        return (
            <section className="status-panel" role="alert">
                <h1>Не удалось проверить вход</h1>
                <p>Подключение недоступно. Это не означает, что вы вышли из аккаунта.</p>
                <button onClick={() => (runtime.error ? window.location.reload() : void session.refetch())}>
                    Повторить
                </button>
            </section>
        );
    if (!runtime.api || !session.isSuccess || !accepted)
        return (
            <main id="main">
                <ArcPageLoader label="Проверяем сессию…" />
            </main>
        );
    return children ?? <Outlet />;
}
