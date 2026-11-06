import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SignIn, MfaScreen, StaffHome } from '../features/auth/client.js';
import { Providers } from './providers.js';
import { AppErrorBoundary } from './error.js';
import NotFound from './not-found.js';
import { AdminWorkspaceShell } from '../widgets/admin-shell/client.js';
import { SessionGuard } from '../widgets/session-guard/client.js';
import { PageLoader as ArcPageLoader } from '@meal-planner/design-system';
import { prepareApiMode } from './api-mode.js';
import { resolveRoutePresentation } from './routes/manifest.js';

const AdminRecordPage = lazy(async () => ({
    default: (await import('../widgets/admin-record-page/client.js')).AdminRecordPage,
}));
const NewsPage = lazy(async () => ({ default: (await import('../features/news/client.js')).NewsPage }));
const NotificationSettingsPage = lazy(async () => ({
    default: await (await import('../features/notifications/client.js')).loadNotificationSettingsPage(),
}));
const NotificationCenterPage = lazy(async () => ({
    default: await (await import('../features/notifications/client.js')).loadNotificationCenterPage(),
}));
const RecipePolicyPage = lazy(async () => ({
    default: (await import('../features/settings/client.js')).RecipePolicyPage,
}));
const AllergensPage = lazy(async () => ({
    default: (await import('../features/allergens/client.js')).AllergensPage,
}));
const ReleasesPage = lazy(async () => ({
    default: await (await import('../features/releases/client.js')).loadReleasesPage(),
}));
const ReleaseDetailPage = lazy(async () => ({
    default: await (await import('../features/releases/client.js')).loadReleaseDetailPage(),
}));
const AchievementsPage = lazy(async () => ({
    default: await (await import('../features/releases/client.js')).loadAchievementsPage(),
}));
const ReputationPage = lazy(async () => ({
    default: await (await import('../features/releases/client.js')).loadReputationPage(),
}));
const ObservabilityPage = lazy(async () => ({
    default: (await import('../features/observability/client.js')).ObservabilityPage,
}));
const AiControlPage = lazy(async () => ({
    default: (await import('../features/ai-control/client.js')).AiControlPage,
}));
const AcceptanceTestingPage = lazy(async () => ({
    default: (await import('../features/acceptance-testing/client.js')).AcceptanceTestingPage,
}));
const RuntimeSettingsPage = lazy(async () => ({
    default: (await import('../features/runtime-settings/client.js')).RuntimeSettingsPage,
}));
const ScenarioConsole =
    import.meta.env.DEV && import.meta.env.VITE_API_MODE === 'mock'
        ? lazy(async () => ({ default: (await import('../mocks/scenario-console.js')).ScenarioConsole }))
        : null;

function RouteMetadata() {
    const { pathname } = useLocation();
    const previousPath = useRef(pathname);
    useEffect(() => {
        const { title } = resolveRoutePresentation(pathname);
        document.title = `${title} · Meal Planner Admin`;
        if (previousPath.current === pathname) return;
        previousPath.current = pathname;
        const frame = requestAnimationFrame(() => {
            const main = document.getElementById('main');
            if (!main) return;
            main.tabIndex = -1;
            main.focus({ preventScroll: true });
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        });
        return () => cancelAnimationFrame(frame);
    }, [pathname]);
    return null;
}

export function App() {
    return (
        <AppErrorBoundary code="root_error">
            <BrowserRouter>
                <a className="skip-link" href="#main">
                    К содержимому
                </a>
                <RouteMetadata />
                <AppErrorBoundary code="route_error">
                    <Providers prepareApi={prepareApiMode}>
                        <Suspense fallback={<ArcPageLoader />}>
                            <Routes>
                                <Route element={<SessionGuard context="admin" />}>
                                    <Route path="/" element={<StaffHome context="admin" />} />
                                    <Route element={<AdminWorkspaceShell />}>
                                        <Route path="/admin" element={<AdminRecordPage />} />
                                        <Route path="/admin/news" element={<NewsPage />} />
                                        <Route path="/admin/catalog/allergens" element={<AllergensPage />} />
                                        <Route path="/admin/catalog/allergens/:code" element={<AllergensPage />} />
                                        <Route path="/admin/catalog/achievements" element={<AchievementsPage />} />
                                        <Route path="/admin/catalog/achievements/:id" element={<AchievementsPage />} />
                                        <Route path="/admin/catalog/reputation" element={<ReputationPage />} />
                                        <Route path="/admin/releases" element={<ReleasesPage />} />
                                        <Route path="/admin/releases/:id" element={<ReleaseDetailPage />} />
                                        <Route path="/admin/observability" element={<ObservabilityPage />} />
                                        <Route path="/admin/ai" element={<AiControlPage />} />
                                        <Route path="/admin/testing" element={<AcceptanceTestingPage />} />
                                        <Route path="/admin/runtime-settings" element={<RuntimeSettingsPage />} />
                                        <Route
                                            path="/admin/queues"
                                            element={<Navigate replace to="/admin/queues/recipes" />}
                                        />
                                        <Route
                                            path="/admin/queues/recipes"
                                            element={<AdminRecordPage fixedSection="queues" />}
                                        />
                                        <Route
                                            path="/admin/moderation/:id"
                                            element={<AdminRecordPage fixedSection="queues" />}
                                        />
                                        <Route
                                            path="/admin/operations/jobs/:id"
                                            element={<AdminRecordPage fixedSection="operations" />}
                                        />
                                        <Route path="/admin/:section" element={<AdminRecordPage />} />
                                        <Route path="/admin/:section/:id" element={<AdminRecordPage />} />
                                        <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
                                        <Route path="/settings/recipes" element={<RecipePolicyPage />} />
                                        <Route path="/notifications" element={<NotificationCenterPage />} />
                                    </Route>
                                    {ScenarioConsole && <Route path="/dev/scenarios" element={<ScenarioConsole />} />}
                                </Route>
                                <Route path="/auth" element={<SignIn />} />
                                <Route path="/auth/mfa" element={<MfaScreen context="admin" />} />
                                <Route path="*" element={<NotFound />} />
                            </Routes>
                        </Suspense>
                    </Providers>
                </AppErrorBoundary>
            </BrowserRouter>
        </AppErrorBoundary>
    );
}
