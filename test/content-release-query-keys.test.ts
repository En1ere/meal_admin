import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { contentReleaseKeys } from '../src/entities/content-release/index.js';

void test('content release entity preserves the exact session-global workspace cache tuple', () => {
    assert.deepEqual(contentReleaseKeys.workspace, ['admin', 'content-releases']);
});

void test('release consumers share the entity-owned key across one query and exactly five cache writes', async () => {
    const files = [
        'src/features/releases/workspace.ts',
        'src/features/releases/release-list-page.tsx',
        'src/features/releases/release-detail-page.tsx',
        'src/features/releases/catalog-pages.tsx',
        'src/features/releases/use-release-draft.ts',
    ] as const;
    const sources = await Promise.all(files.map((file) => readFile(resolve(file), 'utf8')));
    const workspace = sources[0]!;
    const list = sources[1]!;
    const detail = sources[2]!;
    const catalog = sources[3]!;
    const draft = sources[4]!;
    const cacheWrite = /setQueryData\(contentReleaseKeys\.workspace,\s*result\.workspace\)/gu;

    assert.match(workspace, /queryKey:\s*contentReleaseKeys\.workspace/u);
    assert.match(workspace, /enabled:\s*!!api/u);
    assert.match(workspace, /return loadReleaseWorkspace\(api, signal\)/u);
    assert.equal([...list.matchAll(cacheWrite)].length, 1);
    assert.equal([...detail.matchAll(cacheWrite)].length, 1);
    assert.equal([...catalog.matchAll(cacheWrite)].length, 2);
    assert.equal([...draft.matchAll(cacheWrite)].length, 1);
    assert.equal([...sources.join('\n').matchAll(cacheWrite)].length, 5);
    assert.doesNotMatch(sources.join('\n'), /releaseWorkspaceKey/u);
    assert.doesNotMatch(sources.join('\n'), /\['admin',\s*'content-releases'\]/u);
});
