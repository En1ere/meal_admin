import { contracts, type Principal } from '../shared/api/contracts.generated.js';
import type { MockState } from './model.js';

type Context = {
    state: MockState;
    path: string;
    method: string;
    input: unknown;
    actor: Principal;
    now: number;
    success: (data: unknown) => Response;
    fail: (status: number) => Response;
};

const checksum = (character: string) => character.repeat(64);
const groups = [
    { id: 'database' as const, title: 'База данных', order: 1 },
    { id: 'backend' as const, title: 'Backend/API', order: 2 },
    { id: 'admin' as const, title: 'Админ-панель', order: 3 },
    { id: 'frontend' as const, title: 'Frontend', order: 4 },
];
const cases = [
    {
        id: 'database.infrastructure',
        displayCode: 'DB-01',
        group: 'database' as const,
        order: 1,
        title: 'Базовая инфраструктура PostgreSQL',
        steps: ['Проверить сетевой контур PostgreSQL.', 'Сверить роли, миграции и стартовые данные.'],
        expectedResult: 'База доступна только приложению, миграции актуальны, отклонений целостности нет.',
        source: {
            file: 'meal_backend/docs/DATABASE_TESTING.md',
            anchor: 'базовая-инфраструктура-postgresql',
            checksum: checksum('a'),
        },
    },
    {
        id: 'backend.authentication',
        displayCode: 'API-01',
        group: 'backend' as const,
        order: 1,
        title: 'Регистрация, вход, MFA и сессии',
        steps: ['Создать пользователя.', 'Выполнить вход и MFA.', 'Проверить обновление и завершение сессии.'],
        expectedResult: 'Пользователь входит только после обязательных проверок, сессия отзывается сразу.',
        source: {
            file: 'meal_backend/docs/BACKEND_TESTING.md',
            anchor: 'регистрация-вход-mfa-и-сессии',
            checksum: checksum('b'),
        },
    },
    {
        id: 'admin.themes',
        displayCode: 'ADMIN-01',
        group: 'admin' as const,
        order: 1,
        title: 'Темы и адаптивность',
        steps: ['Проверить четыре темы.', 'Проверить desktop и узкий viewport.', 'Проверить клавиатурный фокус.'],
        expectedResult: 'Интерфейс использует только токены дизайн-системы и остаётся доступным.',
        source: {
            file: 'meal_admin/ADMIN_TESTING.md',
            anchor: 'темы-и-адаптивность',
            checksum: checksum('c'),
        },
    },
    {
        id: 'frontend.interactions',
        displayCode: 'FRONTEND-01',
        group: 'frontend' as const,
        order: 1,
        title: 'Общая оболочка и каждый интерактивный элемент',
        steps: ['Открыть каждый маршрут.', 'Проверить все интерактивные элементы.', 'Проверить состояния ошибок.'],
        expectedResult: 'Каждый доступный элемент выполняет заявленное действие и объясняет ошибки.',
        source: {
            file: 'meal_frontend/FRONTEND_TESTING.md',
            anchor: 'общая-оболочка-и-каждый-интерактивный-элемент',
            checksum: checksum('d'),
        },
    },
];

function resultRow(state: MockState, caseId: string) {
    return (state.admin.tables.acceptance_test_results ?? []).find((row) => row.case_id === caseId);
}

function actorProjection(state: MockState, id: string | null) {
    if (!id) return null;
    const actor = state.users.find((item) => item.id === id);
    return actor ? { id: actor.id, login: actor.login, displayName: actor.name || null } : null;
}

function projectResult(state: MockState, item: (typeof cases)[number]) {
    const row = resultRow(state, item.id);
    if (!row || row.source_checksum !== item.source.checksum)
        return {
            status: 'not_tested' as const,
            comment: '',
            version: 0,
            checkedBy: null,
            checkedAt: null,
            updatedAt: null,
        };
    return {
        status: String(row.status) as 'passed' | 'partial' | 'failed' | 'not_tested',
        comment: String(row.comment ?? ''),
        version: Number(row.version),
        checkedBy: actorProjection(state, row.checked_by == null ? null : String(row.checked_by)),
        checkedAt: row.checked_at == null ? null : String(row.checked_at),
        updatedAt: row.updated_at == null ? null : String(row.updated_at),
    };
}

function workspace(state: MockState) {
    const run = state.admin.tables.acceptance_test_runs?.[0];
    const projected = cases.map((item) => ({ ...item, result: projectResult(state, item) }));
    const count = (status: 'not_tested' | 'passed' | 'partial' | 'failed') =>
        projected.filter((item) => item.result.status === status).length;
    const notTested = count('not_tested');
    return {
        schemaVersion: 1 as const,
        catalog: { version: '2026-10-29.mock', publishedOn: '2026-10-29' },
        run: run ? { id: String(run.id), createdAt: String(run.created_at) } : null,
        summary: {
            total: projected.length,
            notTested,
            passed: count('passed'),
            partial: count('partial'),
            failed: count('failed'),
            completed: projected.length - notTested,
        },
        groups: groups.map((group) => ({
            ...group,
            cases: projected
                .filter((item) => item.group === group.id)
                .map((item) => ({
                    id: item.id,
                    displayCode: item.displayCode,
                    order: item.order,
                    title: item.title,
                    steps: item.steps,
                    expectedResult: item.expectedResult,
                    source: item.source,
                    result: item.result,
                })),
        })),
    };
}

export function acceptanceTestingHandle(c: Context): Response | null {
    if (c.path === '/api/v1/admin/acceptance-tests' && c.method === 'GET') return c.success(workspace(c.state));
    const match = /^\/api\/v1\/admin\/acceptance-tests\/([^/]+)(\/reset)?$/u.exec(c.path);
    if (!match || !['PUT', 'POST'].includes(c.method)) return null;
    let caseId: string;
    try {
        caseId = decodeURIComponent(match[1]!);
    } catch {
        return c.fail(400);
    }
    const item = cases.find((candidate) => candidate.id === caseId);
    if (!item) return c.fail(404);
    const reset = match[2] === '/reset';
    if ((reset && c.method !== 'POST') || (!reset && c.method !== 'PUT')) return c.fail(404);
    const resetInput = reset
        ? contracts['POST /api/v1/admin/acceptance-tests/{caseId}/reset'].request.parse(c.input)
        : null;
    const updateInput = reset ? null : contracts['PUT /api/v1/admin/acceptance-tests/{caseId}'].request.parse(c.input);
    const input = resetInput ?? updateInput!;
    const key = `acceptance:${c.actor.id}:${caseId}:${input.idempotencyKey}`;
    const digest = JSON.stringify({ reset, caseId, ...input, idempotencyKey: undefined });
    const replay = c.state.admin.commands[key];
    if (replay) {
        if (replay.digest !== digest) return c.fail(409);
        return c.success(JSON.parse(String(replay.result.response)));
    }
    const current = projectResult(c.state, item);
    if (current.version !== input.expectedVersion) return c.fail(412);
    const now = new Date(c.now).toISOString();
    const run = (c.state.admin.tables.acceptance_test_runs ??= [
        { id: crypto.randomUUID(), created_at: now, catalog_version: '2026-10-29.mock', version: 1 },
    ])[0]!;
    const runId = String(run.id);
    const runCreatedAt = String(run.created_at);
    const next = {
        case_id: caseId,
        status: reset ? 'not_tested' : updateInput!.status,
        comment: reset ? current.comment : updateInput!.comment,
        version: current.version + 1,
        checked_by: c.actor.id,
        checked_at: now,
        updated_at: now,
        source_checksum: item.source.checksum,
        run_id: runId,
    };
    const rows = (c.state.admin.tables.acceptance_test_results ??= []);
    const index = rows.findIndex((row) => row.case_id === caseId);
    if (index >= 0) rows[index] = next;
    else rows.push(next);
    const response = { caseId, run: { id: runId, createdAt: runCreatedAt }, result: projectResult(c.state, item) };
    c.state.admin.commands[key] = { digest, result: { response: JSON.stringify(response) } };
    return c.success(response);
}
