import assert from 'node:assert/strict';
import test from 'node:test';
import { supportTicketKeys } from '../src/entities/support-ticket/index.js';

void test('support ticket cache keys are session scoped and ticket prefixed', () => {
    const ticketId = '10000000-0000-4000-8000-000000000005';

    assert.deepEqual(supportTicketKeys.root, ['support-ticket']);
    assert.deepEqual(supportTicketKeys.forSession('session-a'), ['support-ticket', 'session-a']);
    assert.deepEqual(supportTicketKeys.ticket('session-a', ticketId), [
        'support-ticket',
        'session-a',
        'ticket',
        ticketId,
    ]);
    assert.deepEqual(supportTicketKeys.workspace('session-a', ticketId), [
        'support-ticket',
        'session-a',
        'ticket',
        ticketId,
        'workspace',
    ]);
    assert.deepEqual(supportTicketKeys.messages('session-a', ticketId), [
        'support-ticket',
        'session-a',
        'ticket',
        ticketId,
        'messages',
    ]);
    assert.notDeepEqual(
        supportTicketKeys.messages('session-a', ticketId),
        supportTicketKeys.messages('session-b', ticketId),
    );
});
