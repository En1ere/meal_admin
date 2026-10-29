import assert from 'node:assert/strict';
import test from 'node:test';
import { userAccessKeys } from '../src/entities/user-access/index.js';

void test('user access cache keys isolate staff sessions and workflows', () => {
    const userId = '10000000-0000-4000-8000-000000000007';

    assert.deepEqual(userAccessKeys.root, ['user-access']);
    assert.deepEqual(userAccessKeys.forSession('session-a'), ['user-access', 'session-a']);
    assert.deepEqual(userAccessKeys.governance('session-a', 'users', userId), [
        'user-access',
        'session-a',
        'governance',
        'users',
        userId,
    ]);
    assert.deepEqual(userAccessKeys.freeAi('session-a', userId), ['user-access', 'session-a', 'free-ai', userId]);
    assert.notDeepEqual(
        userAccessKeys.governance('session-a', 'users', userId),
        userAccessKeys.governance('session-b', 'users', userId),
    );
});
