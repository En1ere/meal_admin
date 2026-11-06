import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { operationKeys } from '../src/entities/operation/index.js';

void test('operation entity preserves exact principal-scoped workspace tuples', () => {
    assert.deepEqual(operationKeys.root, ['operations-workspace']);
    assert.deepEqual(operationKeys.workspace('principal-1', 'operations', 'job-1', '7'), [
        'operations-workspace',
        'principal-1',
        'operations',
        'job-1',
        '7',
    ]);
    assert.deepEqual(operationKeys.workspace(undefined, 'errors', 'incident-1', '3'), [
        'operations-workspace',
        undefined,
        'errors',
        'incident-1',
        '3',
    ]);
    assert.notDeepEqual(
        operationKeys.workspace('principal-1', 'operations', 'job-1', '7'),
        operationKeys.workspace('principal-2', 'operations', 'job-1', '7'),
    );
});

void test('operations consumer uses entity keys without changing query and invalidation semantics', async () => {
    const source = await readFile(resolve('src/features/operations/operations-workspace.tsx'), 'utf8');
    assert.match(source, /operationKeys\.workspace\(session\.data\?\.id, section, id, itemVersion\)/u);
    assert.match(source, /enabled:\s*!!api/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: operationKeys\.root \}\)/u);
    assert.match(source, /invalidateQueries\(\{ queryKey: adminRecordKeys\.root \}\)/u);
    assert.doesNotMatch(source, /\['operations-workspace',\s*session\.data\?\.id/u);
    assert.doesNotMatch(source, /queryKey:\s*\['operations-workspace'\]/u);
});
