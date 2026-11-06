import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { appRouteManifest, resolveRoutePresentation, type AppRouteDefinition } from '../src/app/routes/manifest.js';
import { activeSectionForPath, detailPath, sectionPath, sections } from '../src/entities/admin-section/index.js';

interface JsxRouteInventory {
    path: string | null;
    binding: string;
    index: boolean;
}

function attribute(element: ts.JsxOpeningLikeElement, name: string) {
    return element.attributes.properties.find(
        (property): property is ts.JsxAttribute =>
            ts.isJsxAttribute(property) && ts.isIdentifier(property.name) && property.name.text === name,
    );
}

function inventoryRoutes(source: string): JsxRouteInventory[] {
    const parsed = ts.createSourceFile('app.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const routes: JsxRouteInventory[] = [];
    const record = (element: ts.JsxOpeningLikeElement) => {
        if (element.tagName.getText(parsed) !== 'Route') return;
        const pathAttribute = attribute(element, 'path');
        const path =
            pathAttribute?.initializer && ts.isStringLiteral(pathAttribute.initializer)
                ? pathAttribute.initializer.text
                : null;
        const elementAttribute = attribute(element, 'element');
        routes.push({
            path,
            binding: elementAttribute?.initializer?.getText(parsed) ?? '',
            index: !!attribute(element, 'index'),
        });
    };
    const visit = (node: ts.Node) => {
        if (ts.isJsxElement(node)) {
            record(node.openingElement);
            node.children.forEach(visit);
            return;
        }
        if (ts.isJsxSelfClosingElement(node)) record(node);
        ts.forEachChild(node, visit);
    };
    visit(parsed);
    return routes;
}

function matches(pattern: string, pathname: string) {
    if (pattern === '*') return true;
    const patternSegments = pattern.split('/').filter(Boolean);
    const pathSegments = pathname.split('/').filter(Boolean);
    return (
        patternSegments.length === pathSegments.length &&
        patternSegments.every((segment, index) => segment.startsWith(':') || segment === pathSegments[index])
    );
}

void test('typed route manifest preserves all 29 JSX route nodes, order and bindings', async () => {
    const source = await readFile(resolve('src/app/app.tsx'), 'utf8');
    const actual = inventoryRoutes(source);
    const expected: readonly AppRouteDefinition[] = appRouteManifest;
    assert.equal(actual.length, 29);
    assert.deepEqual(
        actual.map((route) => route.path),
        expected.map((route) => route.path ?? null),
    );
    assert.ok(
        actual.every((route) => !route.index),
        '3A must not invent index routes',
    );
    expected.forEach((route, index) =>
        assert.match(actual[index]?.binding ?? '', new RegExp(`\\b${route.binding}\\b`, 'u')),
    );

    const redirect = expected.find((route) => route.kind === 'redirect');
    assert.equal(redirect?.redirectTo, '/admin/queues/recipes');
    const redirectIndex = expected.findIndex((route) => route.kind === 'redirect');
    assert.notEqual(redirectIndex, -1);
    assert.match(actual[redirectIndex]?.binding ?? '', /<Navigate replace to="\/admin\/queues\/recipes" \/>/u);
    assert.match(source, /ScenarioConsole\s*&&\s*<Route path="\/dev\/scenarios"/u);
    assert.equal(expected.find((route) => route.id === 'mock-scenarios')?.conditional, 'mock-dev');
    assert.equal(expected.at(-1)?.path, '*');
});

void test('lazy bindings, session boundary and focus transition remain unchanged', async () => {
    const source = await readFile(resolve('src/app/app.tsx'), 'utf8');
    const expected: readonly AppRouteDefinition[] = appRouteManifest;
    const lazyBindings = [...new Set(expected.filter((route) => route.lazy).map((route) => route.binding))];
    for (const binding of lazyBindings) {
        assert.match(source, new RegExp(`const\\s+${binding}\\s*=[\\s\\S]{0,220}?lazy\\(`, 'u'));
    }
    assert.deepEqual(
        expected.filter((route) => route.access === 'unguarded').map((route) => route.id),
        ['admin-sign-in', 'admin-mfa', 'not-found'],
    );
    assert.equal(expected.filter((route) => route.access === 'admin-session').length, 26);
    assert.match(source, /requestAnimationFrame\(\(\) =>/u);
    assert.match(source, /main\.focus\(\{ preventScroll: true \}\)/u);
    assert.match(source, /window\.scrollTo\(\{ top: 0, left: 0, behavior: 'instant' \}\)/u);
});

void test('route presentation preserves exact titles and legacy edge interpretation', () => {
    const cases = [
        ['/', 'Администрирование', undefined, false],
        ['/admin', 'Обзор', 'overview', false],
        ['/admin/news', 'Новости', 'news', false],
        ['/admin/releases/abc', 'Карточка · Релизы', 'releases', true],
        ['/admin/catalog/allergens', 'Словарь аллергенов', 'catalog', false],
        ['/admin/catalog/allergens/gluten', 'Карточка · Каталог', 'catalog', true],
        ['/admin/queues/recipes', 'Очереди', 'queues', false],
        ['/admin/queues/recipes/extra', 'Очереди', 'queues', false],
        ['/admin/moderation/abc', 'Карточка · Очереди', 'queues', true],
        ['/admin/operations/jobs/abc', 'Карточка · Операции', 'operations', true],
        ['/admin/ai', 'AI-контур', undefined, false],
        ['/settings/notifications', 'Настройки уведомлений', undefined, false],
        ['/auth', 'Вход администратора', undefined, false],
        ['/auth/', 'Страница не найдена', undefined, false],
        ['/admin/unknown', 'Страница не найдена', undefined, false],
        ['/unknown', 'Страница не найдена', undefined, false],
    ] as const;
    for (const [pathname, title, section, detail] of cases) {
        assert.deepEqual(resolveRoutePresentation(pathname), {
            title,
            ...(section ? { section } : {}),
            detail,
        });
    }
});

void test('manifest paths remain compatible with admin-section canonical navigation', () => {
    const definitions: readonly AppRouteDefinition[] = appRouteManifest;
    const paths = definitions.flatMap((route) => (route.path ? [route.path] : []));
    for (const section of sections) {
        const canonical = sectionPath(section.id);
        assert.ok(
            paths.some((pattern) => matches(pattern, canonical)),
            `${section.id} list route is missing`,
        );
        assert.equal(activeSectionForPath(canonical), section.id);

        const detail = detailPath(section.id, '10000000-0000-4000-8000-000000000001');
        assert.ok(
            paths.some((pattern) => matches(pattern, detail)),
            `${section.id} detail route is missing`,
        );
        assert.deepEqual(resolveRoutePresentation(detail), {
            title: `Карточка · ${section.title}`,
            section: section.id,
            detail: true,
        });
    }
});
