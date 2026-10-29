import assert from 'node:assert/strict';
import test from 'node:test';
import { contracts } from '../src/shared/api/contracts.generated.js';
import {
    acceptanceTestKeys,
    adjacentAcceptanceCase,
    filterAcceptanceGroups,
    flattenAcceptanceCases,
    groupProgress,
    orderedGroups,
    type AcceptanceResult,
    type AcceptanceWorkspace,
} from '../src/entities/acceptance-test/index.js';
import {
    acceptanceDraftFingerprint,
    createAcceptanceSaveCommand,
    draftFromResult,
    isAcceptanceDraftDirty,
} from '../src/features/acceptance-testing/draft-model.js';

const result = (status: AcceptanceResult['status'], version = 0): AcceptanceResult => ({
    status,
    comment: '',
    version,
    checkedBy: null,
    checkedAt: null,
    updatedAt: null,
});

const workspace = {
    schemaVersion: 1,
    catalog: { version: '2026-10-29.test', publishedOn: '2026-10-29' },
    run: null,
    summary: { total: 5, notTested: 3, passed: 1, partial: 1, failed: 0, completed: 2 },
    groups: [
        {
            id: 'backend',
            title: 'Backend/API',
            order: 2,
            cases: [
                {
                    id: 'backend.auth',
                    displayCode: 'API-02',
                    order: 2,
                    title: 'Авторизация и MFA',
                    steps: ['Войти', 'Проверить MFA'],
                    expectedResult: 'Сессия создана безопасно.',
                    source: { file: 'meal_backend/docs/BACKEND_TESTING.md', anchor: 'auth', checksum: 'b'.repeat(64) },
                    result: result('partial', 2),
                },
            ],
        },
        {
            id: 'database',
            title: 'База данных',
            order: 1,
            cases: [
                {
                    id: 'database.infrastructure',
                    displayCode: 'DB-02',
                    order: 2,
                    title: 'Инфраструктура PostgreSQL',
                    steps: ['Проверить pg_hba.conf'],
                    expectedResult: 'Подключения ограничены.',
                    source: {
                        file: 'meal_backend/docs/DATABASE_TESTING.md',
                        anchor: 'infra',
                        checksum: 'c'.repeat(64),
                    },
                    result: result('not_tested'),
                },
                {
                    id: 'database.baseline',
                    displayCode: 'DB-01',
                    order: 1,
                    title: 'Baseline',
                    steps: ['Зафиксировать baseline'],
                    expectedResult: 'Baseline записан.',
                    source: {
                        file: 'meal_backend/docs/DATABASE_TESTING.md',
                        anchor: 'baseline',
                        checksum: 'a'.repeat(64),
                    },
                    result: result('passed', 1),
                },
            ],
        },
        {
            id: 'admin',
            title: 'Админ-панель',
            order: 3,
            cases: [
                {
                    id: 'admin.themes',
                    displayCode: 'ADMIN-01',
                    order: 1,
                    title: 'Темы',
                    steps: ['Проверить четыре темы'],
                    expectedResult: 'Темы используют дизайн-токены.',
                    source: { file: 'meal_admin/ADMIN_TESTING.md', anchor: 'themes', checksum: 'd'.repeat(64) },
                    result: result('not_tested'),
                },
            ],
        },
        {
            id: 'frontend',
            title: 'Frontend',
            order: 4,
            cases: [
                {
                    id: 'frontend.navigation',
                    displayCode: 'FRONTEND-01',
                    order: 1,
                    title: 'Навигация',
                    steps: ['Открыть каждый маршрут'],
                    expectedResult: 'Маршруты работают.',
                    source: {
                        file: 'meal_frontend/FRONTEND_TESTING.md',
                        anchor: 'navigation',
                        checksum: 'e'.repeat(64),
                    },
                    result: result('not_tested'),
                },
            ],
        },
    ],
} as unknown as AcceptanceWorkspace;

void test('acceptance workspace uses generated strict contract and session-scoped keys', () => {
    const envelope = { data: workspace, meta: { requestId: crypto.randomUUID() } };
    assert.equal(contracts['GET /api/v1/admin/acceptance-tests'].success.safeParse(envelope).success, true);
    assert.equal(
        contracts['GET /api/v1/admin/acceptance-tests'].success.safeParse({
            ...envelope,
            data: { ...workspace, unexpected: true },
        }).success,
        false,
    );
    assert.notDeepEqual(acceptanceTestKeys.workspace('session-a'), acceptanceTestKeys.workspace('session-b'));
});

void test('acceptance presentation preserves stable order, filtering and visible navigation', () => {
    const groups = orderedGroups(workspace);
    assert.deepEqual(
        groups.map((group) => group.id),
        ['database', 'backend', 'admin', 'frontend'],
    );
    assert.deepEqual(
        groups[0]!.cases.map((item) => item.displayCode),
        ['DB-01', 'DB-02'],
    );
    assert.deepEqual(groupProgress(groups[0]!), { completed: 1, total: 2 });
    const filtered = filterAcceptanceGroups(groups, 'MFA', 'partial');
    const cases = flattenAcceptanceCases(filtered);
    assert.deepEqual(
        cases.map((item) => item.id),
        ['backend.auth'],
    );
    assert.equal(
        adjacentAcceptanceCase(flattenAcceptanceCases(groups), 'database.baseline', 1)?.id,
        'database.infrastructure',
    );
});

void test('draft model requires explicit reset for not tested and freezes save intent', () => {
    const source = result('not_tested');
    const initial = draftFromResult(source);
    assert.equal(createAcceptanceSaveCommand(initial, source.version), null);
    const changed = { status: 'partial' as const, comment: 'Письмо приходит с задержкой.' };
    assert.equal(isAcceptanceDraftDirty(changed, source), true);
    const command = createAcceptanceSaveCommand(changed, source.version);
    assert.ok(command);
    assert.equal(command.status, 'partial');
    assert.equal(command.comment, 'Письмо приходит с задержкой.');
    assert.equal(command.expectedVersion, 0);
    assert.match(command.idempotencyKey, /^[0-9a-f-]{36}$/i);
    assert.equal(acceptanceDraftFingerprint(changed, 0), acceptanceDraftFingerprint({ ...changed }, 0));
});
