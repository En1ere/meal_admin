import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { newsKeys } from '../src/entities/news/index.js';

void test('news entity preserves the exact workspace cache tuple', () => {
    assert.deepEqual(newsKeys.workspace, ['admin-news-workspace']);
});

void test('news consumer uses one entity-owned key for query and command result cache', async () => {
    const source = await readFile(resolve('src/features/news/news-workspace.tsx'), 'utf8');
    assert.match(source, /queryKey:\s*newsKeys\.workspace/u);
    assert.match(source, /cache\.setQueryData\(newsKeys\.workspace, result\)/u);
    assert.match(source, /queryFn:\s*\(\{ signal \}\) => api\(\{ action: 'list' \}, signal\)/u);
    assert.doesNotMatch(source, /queryKey:\s*\['admin-news-workspace'\]/u);
    assert.doesNotMatch(source, /setQueryData\(\['admin-news-workspace'\]/u);
});
