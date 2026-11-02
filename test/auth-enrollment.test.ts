import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRecoveryCodes, safeOtpAuthUri } from '../src/features/auth/enrollment-model.js';

await test('TOTP enrollment accepts only authenticator URIs', () => {
    const secret = 'ABC123';
    const uri = `otpauth://totp/Meal%20Planner%3Aadmin?secret=${secret}&issuer=Meal%20Planner`;
    assert.equal(
        safeOtpAuthUri(uri, secret),
        'otpauth://totp/Meal%20Planner%3Aadmin?secret=ABC123&issuer=Meal+Planner&algorithm=SHA1&digits=6&period=30',
    );
    assert.equal(
        safeOtpAuthUri(`${uri}&algorithm=sha1&digits=6&period=30`, secret),
        'otpauth://totp/Meal%20Planner%3Aadmin?secret=ABC123&issuer=Meal+Planner&algorithm=SHA1&digits=6&period=30',
    );
});

await test('TOTP enrollment fails closed on an ambiguous or unsupported URI', () => {
    const secret = 'ABC123';
    for (const value of [
        'https://example.test',
        'javascript:alert(1)',
        `otpauth://hotp/Meal?secret=${secret}&issuer=Meal%20Planner`,
        `otpauth://user@totp/Meal?secret=${secret}&issuer=Meal%20Planner`,
        `otpauth://totp/?secret=${secret}&issuer=Meal%20Planner`,
        `otpauth://totp/Meal?secret=WRONG&issuer=Meal%20Planner`,
        `otpauth://totp/Meal?secret=${secret}&secret=${secret}&issuer=Meal%20Planner`,
        `otpauth://totp/Meal?secret=${secret}&issuer=Other`,
        `otpauth://totp/Meal?secret=${secret}&issuer=Meal%20Planner#fragment`,
        `otpauth://totp/Meal?secret=${secret}&issuer=Meal%20Planner&algorithm=SHA256`,
        `otpauth://totp/Meal?secret=${secret}&issuer=Meal%20Planner&digits=8`,
        `otpauth://totp/Meal?secret=${secret}&issuer=Meal%20Planner&period=60`,
        'not-a-uri',
    ])
        assert.equal(safeOtpAuthUri(value, secret), null, value);
    assert.equal(safeOtpAuthUri(`otpauth://totp/Meal?secret=&issuer=Meal%20Planner`, ''), null);
});

await test('recovery codes are copied one per line without transformation', () => {
    assert.equal(formatRecoveryCodes(['FIRST-CODE', 'SECOND-CODE']), 'FIRST-CODE\nSECOND-CODE');
});
