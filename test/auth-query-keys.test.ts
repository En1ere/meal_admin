import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { staffSessionKeys } from '../src/entities/staff-session/model.js';
import { authQueryKeys } from '../src/shared/auth/query-keys.js';

void test('shared auth preserves exact session, session-list and admin-status tuples', () => {
    assert.deepEqual(authQueryKeys.sessionRoot, ['session']);
    assert.deepEqual(authQueryKeys.currentSession('admin'), ['session', 'admin']);
    assert.deepEqual(authQueryKeys.sessions('admin'), ['sessions', 'admin']);
    assert.deepEqual(authQueryKeys.adminStatus, ['admin-auth-status']);
});

void test('staff session compatibility keys delegate to the shared auth source', () => {
    assert.strictEqual(staffSessionKeys.root, authQueryKeys.sessionRoot);
    assert.strictEqual(staffSessionKeys.current, authQueryKeys.currentSession);
    assert.deepEqual(staffSessionKeys.current('admin'), ['session', 'admin']);
});

void test('auth consumers preserve clear-before-set, query, invalidation and compatibility semantics', async () => {
    const [runtime, authScreen, unlockScreen, sessionsPanel, adminStatus, accessClient, staffModel] = await Promise.all(
        [
            'src/shared/runtime/index.tsx',
            'src/features/auth/auth-screen.tsx',
            'src/features/auth/unlock-screen.tsx',
            'src/features/auth/sessions-panel.tsx',
            'src/shared/auth/admin-status.ts',
            'src/features/auth/access-client.ts',
            'src/entities/staff-session/model.ts',
        ].map((file) => readFile(resolve(file), 'utf8')),
    );
    const currentSessionWrite =
        /setQueryData\(authQueryKeys\.currentSession\('admin'\), (?:null|response\.data\.user)\)/gu;

    assert.equal([...runtime!.matchAll(currentSessionWrite)].length, 1);
    assert.equal([...authScreen!.matchAll(currentSessionWrite)].length, 1);
    assert.equal([...unlockScreen!.matchAll(currentSessionWrite)].length, 1);
    assert.match(
        runtime!,
        /queryClient\.clear\(\);[\s\S]*?setQueryData\(authQueryKeys\.currentSession\('admin'\), null\)/u,
    );
    assert.match(
        authScreen!,
        /queryClient\.clear\(\);[\s\S]*?setQueryData\(authQueryKeys\.currentSession\('admin'\), response\.data\.user\)/u,
    );
    assert.match(
        unlockScreen!,
        /queryClient\.clear\(\);[\s\S]*?setQueryData\(authQueryKeys\.currentSession\('admin'\), response\.data\.user\)/u,
    );
    assert.match(adminStatus!, /export const adminAuthStatusKey = authQueryKeys\.adminStatus/u);
    assert.match(adminStatus!, /queryKey:\s*adminAuthStatusKey/u);
    assert.match(unlockScreen!, /invalidateQueries\(\{ queryKey: adminAuthStatusKey \}\)/u);
    assert.equal([...sessionsPanel!.matchAll(/authQueryKeys\.sessions\(kind\)/gu)].length, 2);
    assert.match(sessionsPanel!, /enabled:\s*!!runtime\.api/u);
    assert.match(
        accessClient!,
        /export \{ adminAuthStatusKey, useAdminStatus \} from '\.\.\/\.\.\/shared\/auth\/admin-status\.js'/u,
    );
    assert.match(staffModel!, /root:\s*authQueryKeys\.sessionRoot/u);
    assert.match(staffModel!, /current:\s*authQueryKeys\.currentSession/u);
    assert.doesNotMatch(
        [runtime, authScreen, unlockScreen, sessionsPanel].join('\n'),
        /(?:queryKey:|setQueryData\(|invalidateQueries\(\{ queryKey:)\s*\['(?:session|sessions|admin-auth-status)'/u,
    );
});

void test('shared auth owners preserve compatibility identity and critical confirmation state semantics', async () => {
    const [adminStatus, confirmation, compatibility, unlockScreen, sharedCss, featureCss] = await Promise.all(
        [
            'src/shared/auth/admin-status.ts',
            'src/shared/auth/critical-confirmation.tsx',
            'src/features/auth/access-client.ts',
            'src/features/auth/unlock-screen.tsx',
            'src/shared/auth/critical-confirmation.module.css',
            'src/features/auth/security.module.css',
        ].map((file) => readFile(resolve(file), 'utf8')),
    );
    assert.match(adminStatus!, /export const adminAuthStatusKey = authQueryKeys\.adminStatus/u);
    assert.match(
        compatibility!,
        /export \{ CriticalConfirmation \} from '\.\.\/\.\.\/shared\/auth\/critical-confirmation\.js'/u,
    );
    assert.match(
        compatibility!,
        /export \{ adminAuthStatusKey, useAdminStatus \} from '\.\.\/\.\.\/shared\/auth\/admin-status\.js'/u,
    );
    assert.match(
        unlockScreen!,
        /export \{ adminAuthStatusKey, useAdminStatus \} from '\.\.\/\.\.\/shared\/auth\/admin-status\.js'/u,
    );
    assert.match(adminStatus!, /GET \/api\/v1\/admin\/auth\/status/u);
    assert.match(adminStatus!, /error instanceof ApiError && error\.status === 401\) return null/u);
    assert.match(confirmation!, /POST \/api\/v1\/admin\/auth\/critical-confirm/u);
    assert.match(confirmation!, /await status\.refetch\(\);[\s\S]*?setNow\(Date\.now\(\)\)/u);
    assert.match(confirmation!, /latest\.data === null[\s\S]*?runtime\.reset\(\);[\s\S]*?runtime\.broadcast\(\)/u);
    assert.match(confirmation!, /setInterval\(\(\) => setNow\(Date\.now\(\)\), 1000\)/u);
    assert.match(confirmation!, /return \(\) => clearInterval\(timer\)/u);
    assert.match(confirmation!, /InlineLoader as ArcInlineLoader/u);
    assert.match(confirmation!, /critical-confirmation\.module\.css/u);
    assert.match(sharedCss!, /\.form[\s\S]*?display: grid/u);
    assert.match(sharedCss!, /\.alternate[\s\S]*?min-height: 44px/u);
    assert.doesNotMatch(featureCss!, /\.form/u);
    assert.match(featureCss!, /\.alternate/u);
});

void test('production consumers use specialized shared auth owners and compatibility has zero consumers', async () => {
    const criticalConsumers = [
        'src/features/user-governance/governance-actions.tsx',
        'src/features/user-governance/free-ai-workspace.tsx',
        'src/features/news/news-workspace.tsx',
        'src/features/content/content-workspace.tsx',
        'src/features/review/review-workspace.tsx',
        'src/features/billing/billing-workspace.tsx',
        'src/features/review/account-deletion-review.tsx',
        'src/features/settings/recipe-policy.tsx',
        'src/features/operations/operations-workspace.tsx',
        'src/features/runtime-settings/runtime-settings-page.tsx',
        'src/features/releases/release-sections.tsx',
    ];
    const sources = await Promise.all(criticalConsumers.map((file) => readFile(resolve(file), 'utf8')));
    assert.equal(sources.length, 11);
    for (const source of sources) {
        assert.match(source, /shared\/auth\/critical-confirmation\.js/u);
        assert.doesNotMatch(source, /features\/auth\/access-client|\.\.\/auth\/access-client/u);
    }
    assert.match(sources[3]!, /shared\/auth\/admin-status\.js/u);

    const [authScreen, unlockScreen, sessionsPanel] = await Promise.all(
        [
            'src/features/auth/auth-screen.tsx',
            'src/features/auth/unlock-screen.tsx',
            'src/features/auth/sessions-panel.tsx',
        ].map((file) => readFile(resolve(file), 'utf8')),
    );
    assert.match(authScreen!, /shared\/auth\/admin-status\.js/u);
    assert.match(unlockScreen!, /shared\/auth\/admin-status\.js/u);
    assert.match(sessionsPanel!, /shared\/auth\/critical-confirmation\.js/u);
});
