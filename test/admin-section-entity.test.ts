import test from 'node:test';
import assert from 'node:assert/strict';
import { activeSectionForPath, detailPath, sectionPath } from '../src/entities/admin-section/model.js';
import { adminRecordKeys } from '../src/entities/admin-record/query-keys.js';

void test('admin section entity keeps canonical routes and resolves shell state', () => {
    assert.equal(sectionPath('overview'), '/admin');
    assert.equal(sectionPath('queues'), '/admin/queues/recipes');
    assert.equal(detailPath('queues', 'pending/id'), '/admin/moderation/pending%2Fid');
    assert.equal(detailPath('operations', 'job/id'), '/admin/operations/jobs/job%2Fid');
    assert.equal(activeSectionForPath('/admin/catalog/allergens/milk'), 'catalog');
    assert.equal(activeSectionForPath('/admin/releases/release-id'), 'releases');
    assert.equal(activeSectionForPath('/admin/moderation/revision-id'), 'queues');
    assert.equal(activeSectionForPath('/admin/operations/jobs/job-id'), 'operations');
    assert.equal(activeSectionForPath('/admin/unknown'), 'overview');
    assert.deepEqual(adminRecordKeys.list('session-1', 'users', { query: 'admin' }), [
        'admin-record',
        'session-1',
        'list',
        'users',
        { query: 'admin' },
    ]);
    assert.deepEqual(adminRecordKeys.detail('session-1', 'users', 'user-1'), [
        'admin-record',
        'session-1',
        'detail',
        'users',
        'user-1',
    ]);
    assert.deepEqual(adminRecordKeys.related('session-1', 'users', 'user-1'), [
        'admin-record',
        'session-1',
        'related',
        'users',
        'user-1',
    ]);
    assert.notDeepEqual(
        adminRecordKeys.detail('session-1', 'users', 'user-1'),
        adminRecordKeys.detail('session-2', 'users', 'user-1'),
    );
});
