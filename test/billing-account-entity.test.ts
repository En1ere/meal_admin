import assert from 'node:assert/strict';
import test from 'node:test';
import {
    availableRefundMinor,
    billingAccountKeys,
    deriveBillingCapabilities,
    formatRublesFromMinor,
    parseMinorUnits,
} from '../src/entities/billing-account/index.js';

void test('billing account cache keys isolate staff sessions and preserve exact minor units', () => {
    const accountId = '10000000-0000-4000-8000-000000000007';

    assert.deepEqual(billingAccountKeys.root, ['billing-account']);
    assert.deepEqual(billingAccountKeys.forSession('session-a'), ['billing-account', 'session-a']);
    assert.deepEqual(billingAccountKeys.workspace('session-a', 'users', accountId), [
        'billing-account',
        'session-a',
        'users',
        accountId,
    ]);
    assert.notDeepEqual(
        billingAccountKeys.workspace('session-a', 'users', accountId),
        billingAccountKeys.workspace('session-b', 'users', accountId),
    );
    assert.equal(formatRublesFromMinor('0'), '0,00 ₽');
    assert.equal(formatRublesFromMinor('1'), '0,01 ₽');
    assert.equal(formatRublesFromMinor('29900'), '299,00 ₽');
    assert.equal(formatRublesFromMinor('900719925474099312345'), '9007199254740993123,45 ₽');
    assert.equal(formatRublesFromMinor('-1'), 'Некорректная сумма');
    assert.equal(formatRublesFromMinor('broken'), 'Некорректная сумма');
    assert.equal(parseMinorUnits('001'), 1n);
    assert.equal(parseMinorUnits('1.5'), null);
    assert.equal(parseMinorUnits('9'.repeat(129)), null);
});

void test('billing ledger and action capabilities fail closed', () => {
    assert.deepEqual(availableRefundMinor({ paidMinor: '1000', returnedMinor: '200', reservedMinor: '300' }), {
        availableMinor: '500',
        isConsistent: true,
    });
    assert.deepEqual(availableRefundMinor({ paidMinor: '100', returnedMinor: '200', reservedMinor: '0' }), {
        availableMinor: null,
        isConsistent: false,
    });
    assert.deepEqual(availableRefundMinor({ paidMinor: 'oops', returnedMinor: '0', reservedMinor: '0' }), {
        availableMinor: null,
        isConsistent: false,
    });

    const now = Date.parse('2030-01-01T00:00:00.000Z');
    const inactive = deriveBillingCapabilities({ frozen: false, periods: [] }, now);
    assert.equal(inactive.canGrant, true);
    assert.equal(inactive.canExtend, false);
    assert.equal(inactive.canFreeze, false);
    assert.equal(inactive.canUnfreeze, false);
    assert.equal(inactive.canRevokeGift, false);

    const activeGift = deriveBillingCapabilities(
        {
            frozen: false,
            periods: [{ source: 'gift', endsAt: '2031-01-01T00:00:00.000Z', revoked: false }],
        },
        now,
    );
    assert.equal(activeGift.canGrant, false);
    assert.equal(activeGift.canExtend, true);
    assert.equal(activeGift.canFreeze, true);
    assert.equal(activeGift.canRevokeGift, true);

    const frozen = deriveBillingCapabilities(
        {
            frozen: true,
            periods: [{ source: 'paid', endsAt: '2031-01-01T00:00:00.000Z', revoked: false }],
        },
        now,
    );
    assert.equal(frozen.canExtend, false);
    assert.equal(frozen.canFreeze, false);
    assert.equal(frozen.canUnfreeze, true);
});
