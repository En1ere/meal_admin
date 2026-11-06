import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import test from 'node:test';

const qaOutput =
    process.env.QA_OUTPUT_DIR ??
    (() => {
        throw new Error('Set QA_OUTPUT_DIR to a dedicated temporary directory');
    })();

const checker = resolve('scripts/check-architecture.mjs');

const validFixture = (): Record<string, string> => ({
    'shared/lib/model.ts': 'export const utility = 1;\n',
    'shared/lib/index.ts': "export { utility } from './model.js';\n",
    'entities/user/index.ts': "import { utility } from '../../shared/lib/index.js';\nexport const user = utility;\n",
    'features/profile/client.ts':
        "import { user } from '../../entities/user/index.js';\nexport const profile = user;\n",
    'widgets/shell/client.ts':
        "import { profile } from '../../features/profile/client.js';\nexport const shell = profile;\n",
    'app/app.ts': "import { shell } from '../widgets/shell/client.js';\nexport const app = shell;\n",
});

async function runFixture(files: Record<string, string>) {
    const root = await mkdtemp(join(resolve(qaOutput), 'architecture-gate-'));
    try {
        await Promise.all(
            Object.entries(files).map(async ([name, source]) => {
                const target = join(root, name);
                await mkdir(resolve(target, '..'), { recursive: true });
                await writeFile(target, source, 'utf8');
            }),
        );
        const result = spawnSync(process.execPath, [checker, '--fixture', '--source-root', root], {
            cwd: resolve('.'),
            encoding: 'utf8',
        });
        return { status: result.status, output: `${result.stdout}${result.stderr}` };
    } finally {
        await rm(root, { recursive: true, force: true });
    }
}

void test('architecture gate accepts a valid downward public-entry graph', async () => {
    const result = await runFixture(validFixture());
    assert.equal(result.status, 0, result.output);
});

void test('architecture gate accepts only the explicit admin notification entrypoints', async () => {
    const fixture = validFixture();
    fixture['entities/admin-notification/preferences.ts'] =
        "export type NotificationChannel = 'browser' | 'mobilePush' | 'email';\n";
    fixture['entities/admin-notification/center-contracts.ts'] =
        'export const notificationCenterSchema = { parse: (value: unknown) => value };\n';
    fixture['entities/admin-notification/preferences-query-keys.ts'] =
        "export const preferencesKeys = { root: ['notification-settings'] as const };\n";
    fixture['entities/admin-notification/center-query-keys.ts'] =
        "export const centerKeys = { root: ['notification-center'] as const };\n";
    fixture['entities/admin-notification/index.ts'] =
        "export { preferencesKeys } from './preferences-query-keys.js';\nexport { centerKeys } from './center-query-keys.js';\n";
    fixture['features/profile/client.ts'] = [
        "import type { NotificationChannel } from '../../entities/admin-notification/preferences.js';",
        "import { notificationCenterSchema } from '../../entities/admin-notification/center-contracts.js';",
        "import { preferencesKeys } from '../../entities/admin-notification/preferences-query-keys.js';",
        "export const profile: NotificationChannel = notificationCenterSchema.parse(preferencesKeys.root) ? 'browser' : 'email';",
        '',
    ].join('\n');
    const accepted = await runFixture(fixture);
    assert.equal(accepted.status, 0, accepted.output);

    fixture['entities/admin-notification/internal.ts'] = 'export const privateKey = 1;\n';
    fixture['features/profile/client.ts'] =
        "import { privateKey } from '../../entities/admin-notification/internal.js';\nexport const profile = privateKey;\n";
    const rejected = await runFixture(fixture);
    assert.equal(rejected.status, 1);
    assert.match(rejected.output, /external consumers must use the entities\/admin-notification public entrypoint/u);
});

void test('architecture gate accepts only the explicit specialized shared auth entrypoints', async () => {
    const fixture = validFixture();
    fixture['shared/auth/query-keys.ts'] =
        "export const authQueryKeys = { currentSession: (context: 'admin') => ['session', context] as const, adminStatus: ['admin-auth-status'] as const };\n";
    fixture['shared/auth/admin-status.ts'] =
        "import { authQueryKeys } from './query-keys.js';\nexport const adminAuthStatusKey = authQueryKeys.adminStatus;\n";
    fixture['shared/auth/critical-confirmation.tsx'] = 'export const CriticalConfirmation = () => null;\n';
    fixture['features/profile/client.ts'] = [
        "import { authQueryKeys } from '../../shared/auth/query-keys.js';",
        "import { adminAuthStatusKey } from '../../shared/auth/admin-status.js';",
        "import { CriticalConfirmation } from '../../shared/auth/critical-confirmation.js';",
        "export const profile = [authQueryKeys.currentSession('admin'), adminAuthStatusKey, CriticalConfirmation];",
        '',
    ].join('\n');
    const accepted = await runFixture(fixture);
    assert.equal(accepted.status, 0, accepted.output);

    fixture['shared/auth/internal.ts'] = 'export const privateKey = 1;\n';
    fixture['features/profile/client.ts'] =
        "import { privateKey } from '../../shared/auth/internal.js';\nexport const profile = privateKey;\n";
    const rejected = await runFixture(fixture);
    assert.equal(rejected.status, 1);
    assert.match(rejected.output, /external consumers must use the shared\/auth public entrypoint/u);
});

void test('architecture gate rejects feature-to-feature and entity-to-entity imports', async () => {
    const featureFixture = validFixture();
    featureFixture['features/other/client.ts'] = 'export const other = 1;\n';
    featureFixture['features/profile/client.ts'] =
        "import { other } from '../other/client.js';\nexport const profile = other;\n";
    const featureResult = await runFixture(featureFixture);
    assert.equal(featureResult.status, 1);
    assert.match(featureResult.output, /feature-to-feature imports are forbidden/u);

    const entityFixture = validFixture();
    entityFixture['entities/other/index.ts'] = 'export const other = 1;\n';
    entityFixture['entities/user/index.ts'] =
        "import { other } from '../other/index.js';\nexport const user = other;\n";
    const entityResult = await runFixture(entityFixture);
    assert.equal(entityResult.status, 1);
    assert.match(entityResult.output, /entity-to-entity imports are forbidden/u);
});

void test('architecture gate rejects lower-to-upper and external private imports', async () => {
    const lowerFixture = validFixture();
    lowerFixture['shared/lib/model.ts'] =
        "import { profile } from '../../features/profile/client.js';\nexport const utility = profile;\n";
    const lowerResult = await runFixture(lowerFixture);
    assert.equal(lowerResult.status, 1);
    assert.match(lowerResult.output, /lower layers must not depend on upper layers/u);

    const privateFixture = validFixture();
    privateFixture['features/profile/model.ts'] = 'export const privateProfile = 1;\n';
    privateFixture['widgets/shell/client.ts'] =
        "import { privateProfile } from '../../features/profile/model.js';\nexport const shell = privateProfile;\n";
    const privateResult = await runFixture(privateFixture);
    assert.equal(privateResult.status, 1);
    assert.match(privateResult.output, /external consumers must use the features\/profile public entrypoint/u);
});

void test('architecture gate requires public entrypoints and explicit named exports', async () => {
    const missingFixture = validFixture();
    missingFixture['features/orphan/model.ts'] = 'export const orphan = 1;\n';
    const missingResult = await runFixture(missingFixture);
    assert.equal(missingResult.status, 1);
    assert.match(missingResult.output, /active slice requires an explicit public entrypoint/u);

    const starFixture = validFixture();
    starFixture['entities/wild/model.ts'] = 'export const wild = 1;\n';
    starFixture['entities/wild/index.ts'] = "export * from './model.js';\n";
    const starResult = await runFixture(starFixture);
    assert.equal(starResult.status, 1);
    assert.match(starResult.output, /public entrypoints must use explicit named exports/u);
});

void test('architecture gate detects cycles through string-literal dynamic imports', async () => {
    const fixture = validFixture();
    fixture['shared/a/index.ts'] =
        "export const loadA = () => import('../b/index.js').then((module) => module.loadB);\n";
    fixture['shared/b/index.ts'] =
        "export const loadB = () => import('../a/index.js').then((module) => module.loadA);\n";
    const result = await runFixture(fixture);
    assert.equal(result.status, 1);
    assert.match(result.output, /relative import cycle detected/u);
});

void test('architecture gate rejects undeclared aliases and new literal private query keys', async () => {
    const aliasFixture = validFixture();
    aliasFixture['app/app.ts'] = "import { profile } from '@/features/profile/client.js';\nexport { profile };\n";
    const aliasResult = await runFixture(aliasFixture);
    assert.equal(aliasResult.status, 1);
    assert.match(aliasResult.output, /undeclared bare import or path alias is forbidden/u);

    const queryFixture = validFixture();
    queryFixture['features/profile/client.ts'] = "export const query = { queryKey: ['private'] };\n";
    const queryResult = await runFixture(queryFixture);
    assert.equal(queryResult.status, 1);
    assert.match(queryResult.output, /literal private query\/cache key is forbidden/u);

    const dynamicFixture = validFixture();
    dynamicFixture['app/app.ts'] =
        "const target = '../widgets/shell/client.js';\nexport const load = () => import(target);\n";
    const dynamicResult = await runFixture(dynamicFixture);
    assert.equal(dynamicResult.status, 1);
    assert.match(dynamicResult.output, /computed dynamic imports are forbidden/u);
});

void test('architecture gate prevents recreation of removed legacy feature roots', async () => {
    const fixture = validFixture();
    fixture['features/admin/placeholder.ts'] = 'export const legacy = true;\n';
    const result = await runFixture(fixture);
    assert.equal(result.status, 1);
    assert.match(result.output, /removed legacy feature slice must not be recreated/u);
});
