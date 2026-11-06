import { findSection, type Section } from '../../entities/admin-section/index.js';

export type AppRouteAccess = 'admin-session' | 'unguarded';
export type AppRouteKind = 'layout' | 'screen' | 'redirect' | 'fallback';
export type AppRouteConditional = 'mock-dev';

export interface AppRouteDefinition {
    id: string;
    kind: AppRouteKind;
    path?: string;
    binding: string;
    access: AppRouteAccess;
    title?: string;
    adminSection?: Section;
    adminSectionParam?: 'section';
    detail?: boolean;
    redirectTo?: string;
    conditional?: AppRouteConditional;
    lazy?: boolean;
}

export const appRouteManifest = [
    {
        id: 'admin-session-boundary',
        kind: 'layout',
        binding: 'SessionGuard',
        access: 'admin-session',
    },
    {
        id: 'admin-home',
        kind: 'screen',
        path: '/',
        binding: 'StaffHome',
        access: 'admin-session',
        title: 'Администрирование',
    },
    {
        id: 'admin-workspace-shell',
        kind: 'layout',
        binding: 'AdminWorkspaceShell',
        access: 'admin-session',
    },
    {
        id: 'admin-overview',
        kind: 'screen',
        path: '/admin',
        binding: 'AdminRecordPage',
        access: 'admin-session',
        adminSection: 'overview',
        lazy: true,
    },
    {
        id: 'admin-news',
        kind: 'screen',
        path: '/admin/news',
        binding: 'NewsPage',
        access: 'admin-session',
        adminSection: 'news',
        lazy: true,
    },
    {
        id: 'admin-allergens',
        kind: 'screen',
        path: '/admin/catalog/allergens',
        binding: 'AllergensPage',
        access: 'admin-session',
        title: 'Словарь аллергенов',
        adminSection: 'catalog',
        lazy: true,
    },
    {
        id: 'admin-allergen-detail',
        kind: 'screen',
        path: '/admin/catalog/allergens/:code',
        binding: 'AllergensPage',
        access: 'admin-session',
        adminSection: 'catalog',
        detail: true,
        lazy: true,
    },
    {
        id: 'admin-achievements',
        kind: 'screen',
        path: '/admin/catalog/achievements',
        binding: 'AchievementsPage',
        access: 'admin-session',
        title: 'Достижения',
        adminSection: 'catalog',
        lazy: true,
    },
    {
        id: 'admin-achievement-detail',
        kind: 'screen',
        path: '/admin/catalog/achievements/:id',
        binding: 'AchievementsPage',
        access: 'admin-session',
        adminSection: 'catalog',
        detail: true,
        lazy: true,
    },
    {
        id: 'admin-reputation',
        kind: 'screen',
        path: '/admin/catalog/reputation',
        binding: 'ReputationPage',
        access: 'admin-session',
        title: 'Репутация',
        adminSection: 'catalog',
        lazy: true,
    },
    {
        id: 'admin-releases',
        kind: 'screen',
        path: '/admin/releases',
        binding: 'ReleasesPage',
        access: 'admin-session',
        adminSection: 'releases',
        lazy: true,
    },
    {
        id: 'admin-release-detail',
        kind: 'screen',
        path: '/admin/releases/:id',
        binding: 'ReleaseDetailPage',
        access: 'admin-session',
        adminSection: 'releases',
        detail: true,
        lazy: true,
    },
    {
        id: 'admin-observability',
        kind: 'screen',
        path: '/admin/observability',
        binding: 'ObservabilityPage',
        access: 'admin-session',
        title: 'Наблюдаемость',
        lazy: true,
    },
    {
        id: 'admin-ai',
        kind: 'screen',
        path: '/admin/ai',
        binding: 'AiControlPage',
        access: 'admin-session',
        title: 'AI-контур',
        lazy: true,
    },
    {
        id: 'admin-testing',
        kind: 'screen',
        path: '/admin/testing',
        binding: 'AcceptanceTestingPage',
        access: 'admin-session',
        title: 'Приёмочное тестирование',
        lazy: true,
    },
    {
        id: 'admin-runtime-settings',
        kind: 'screen',
        path: '/admin/runtime-settings',
        binding: 'RuntimeSettingsPage',
        access: 'admin-session',
        title: 'Конфигурация сервиса',
        lazy: true,
    },
    {
        id: 'admin-queues-redirect',
        kind: 'redirect',
        path: '/admin/queues',
        binding: 'Navigate',
        access: 'admin-session',
        adminSection: 'queues',
        redirectTo: '/admin/queues/recipes',
    },
    {
        id: 'admin-recipe-queue',
        kind: 'screen',
        path: '/admin/queues/recipes',
        binding: 'AdminRecordPage',
        access: 'admin-session',
        adminSection: 'queues',
        lazy: true,
    },
    {
        id: 'admin-moderation-detail',
        kind: 'screen',
        path: '/admin/moderation/:id',
        binding: 'AdminRecordPage',
        access: 'admin-session',
        adminSection: 'queues',
        detail: true,
        lazy: true,
    },
    {
        id: 'admin-operation-detail',
        kind: 'screen',
        path: '/admin/operations/jobs/:id',
        binding: 'AdminRecordPage',
        access: 'admin-session',
        adminSection: 'operations',
        detail: true,
        lazy: true,
    },
    {
        id: 'admin-section',
        kind: 'screen',
        path: '/admin/:section',
        binding: 'AdminRecordPage',
        access: 'admin-session',
        adminSectionParam: 'section',
        lazy: true,
    },
    {
        id: 'admin-section-detail',
        kind: 'screen',
        path: '/admin/:section/:id',
        binding: 'AdminRecordPage',
        access: 'admin-session',
        adminSectionParam: 'section',
        detail: true,
        lazy: true,
    },
    {
        id: 'notification-settings',
        kind: 'screen',
        path: '/settings/notifications',
        binding: 'NotificationSettingsPage',
        access: 'admin-session',
        title: 'Настройки уведомлений',
        lazy: true,
    },
    {
        id: 'recipe-settings',
        kind: 'screen',
        path: '/settings/recipes',
        binding: 'RecipePolicyPage',
        access: 'admin-session',
        title: 'Рецепты и антиспам',
        lazy: true,
    },
    {
        id: 'notification-center',
        kind: 'screen',
        path: '/notifications',
        binding: 'NotificationCenterPage',
        access: 'admin-session',
        title: 'Центр уведомлений',
        lazy: true,
    },
    {
        id: 'mock-scenarios',
        kind: 'screen',
        path: '/dev/scenarios',
        binding: 'ScenarioConsole',
        access: 'admin-session',
        title: 'Тестовые сценарии',
        conditional: 'mock-dev',
        lazy: true,
    },
    {
        id: 'admin-sign-in',
        kind: 'screen',
        path: '/auth',
        binding: 'SignIn',
        access: 'unguarded',
        title: 'Вход администратора',
    },
    {
        id: 'admin-mfa',
        kind: 'screen',
        path: '/auth/mfa',
        binding: 'MfaScreen',
        access: 'unguarded',
        title: 'Проверка входа',
    },
    {
        id: 'not-found',
        kind: 'fallback',
        path: '*',
        binding: 'NotFound',
        access: 'unguarded',
        title: 'Страница не найдена',
    },
] as const satisfies readonly AppRouteDefinition[];

const routeDefinitions: readonly AppRouteDefinition[] = appRouteManifest;
const exactRoutes = new Map(
    routeDefinitions.flatMap((route) => (route.path && route.title ? [[route.path, route] as const] : [])),
);
const notFoundTitle = routeDefinitions.find((route) => route.id === 'not-found')?.title ?? 'Страница не найдена';
const adminSectionAliases: Readonly<Record<string, Section>> = { moderation: 'queues' };

export interface RoutePresentation {
    title: string;
    section?: Section;
    detail: boolean;
}

export function resolveRoutePresentation(pathname: string): RoutePresentation {
    const exactRoute = exactRoutes.get(pathname);
    if (exactRoute?.title)
        return {
            title: exactRoute.title,
            ...(exactRoute.adminSection ? { section: exactRoute.adminSection } : {}),
            detail: exactRoute.detail ?? false,
        };

    const segments = pathname.split('/').filter(Boolean);
    const sectionValue = segments[1] ? (adminSectionAliases[segments[1]] ?? segments[1]) : undefined;
    const section = segments[0] === 'admin' ? findSection(sectionValue) : undefined;
    const detail = !!section && segments.length > 2 && !(segments[1] === 'queues' && segments[2] === 'recipes');
    return {
        title: section ? `${detail ? 'Карточка · ' : ''}${section.title}` : notFoundTitle,
        ...(section ? { section: section.id } : {}),
        detail,
    };
}
