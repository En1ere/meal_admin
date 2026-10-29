import test from 'node:test';
import assert from 'node:assert/strict';
import { staffSessionKeys } from '../src/entities/staff-session/model.js';

void test('staff session entity preserves the exact authenticated cache key', () => {
    assert.deepEqual(staffSessionKeys.root, ['session']);
    assert.deepEqual(staffSessionKeys.current('admin'), ['session', 'admin']);
});
