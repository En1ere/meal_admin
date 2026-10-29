import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ServiceShell, type ServiceNavigationGroup } from '@meal-planner/design-system';
import { sectionPath, sections, type Section } from '../../entities/admin-section/model.js';
import { Brand } from '../../shared/ui/brand.js';
import { ThemeControl } from '../../shared/ui/theme-control.js';

export function AdminShell({ active, children }: { active: Section; children: ReactNode }) {
    const { pathname } = useLocation();
    const standaloneWorkspace = pathname === '/admin/observability' || pathname === '/admin/testing';
    const groups: ServiceNavigationGroup[] = [...new Set(sections.map((section) => section.group))].map((group) => ({
        label: group,
        items: [
            ...sections
                .filter((section) => section.group === group)
                .map((section) => ({
                    href: sectionPath(section.id),
                    label: section.title,
                    active: active === section.id && !standaloneWorkspace,
                })),
            ...(group === 'Система'
                ? [
                      {
                          href: '/admin/observability',
                          label: 'Наблюдаемость',
                          active: pathname === '/admin/observability',
                      },
                      {
                          href: '/admin/testing',
                          label: 'Тестирование',
                          active: pathname === '/admin/testing',
                      },
                  ]
                : []),
            ...(group === 'Контент'
                ? [
                      {
                          href: '/admin/catalog/allergens',
                          label: 'Аллергены',
                          active: pathname.startsWith('/admin/catalog/allergens'),
                          nested: true,
                      },
                      {
                          href: '/admin/catalog/achievements',
                          label: 'Достижения',
                          active: pathname.startsWith('/admin/catalog/achievements'),
                          nested: true,
                      },
                      {
                          href: '/admin/catalog/reputation',
                          label: 'Репутация',
                          active: pathname.startsWith('/admin/catalog/reputation'),
                          nested: true,
                      },
                  ]
                : []),
        ],
    }));
    groups.push({
        label: 'Настройки',
        items: [
            { href: '/settings/recipes', label: 'Рецепты и антиспам', active: pathname === '/settings/recipes' },
            ...(import.meta.env.DEV && import.meta.env.VITE_API_MODE === 'mock'
                ? [{ href: '/dev/scenarios', label: 'Тестовые сценарии', active: pathname === '/dev/scenarios' }]
                : []),
            { href: '/notifications', label: 'Центр уведомлений', active: pathname === '/notifications' },
            { href: '/settings/notifications', label: 'Уведомления', active: pathname === '/settings/notifications' },
            { href: '/', label: 'Сессии и выход', active: pathname === '/' },
        ],
    });

    return (
        <ServiceShell
            brand={<Brand />}
            context="Администрирование"
            navigation={groups}
            themeControl={<ThemeControl compact={false} />}
            renderLink={({ href, className, children: content, ariaCurrent, onClick }) => (
                <Link to={href} className={className} aria-current={ariaCurrent} onClick={onClick}>
                    {content}
                </Link>
            )}
        >
            {children}
        </ServiceShell>
    );
}
