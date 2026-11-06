import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { appRouteManifest } from '../src/app/routes/manifest.js';
import {
    recordTitle,
    adminRecordKeys,
    type AdminRecord,
    type AdminRecordSection,
} from '../src/entities/admin-record/index.js';
import type { Section } from '../src/entities/admin-section/index.js';
import type { BillingSection } from '../src/entities/billing-account/index.js';
import type { GovernanceSection } from '../src/entities/user-access/index.js';
import type { contracts, Success } from '../src/shared/api/contracts.generated.js';

type Equal<Left, Right> =
    (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
        ? (<Value>() => Value extends Right ? 1 : 2) extends <Value>() => Value extends Left ? 1 : 2
            ? true
            : false
        : false;

type BillingWireSection =
    (typeof contracts)['GET /api/v1/admin/billing/{section}/{id}']['params']['_output']['section'];
type GovernanceWireSection =
    (typeof contracts)['GET /api/v1/admin/governance/{section}/{id}']['params']['_output']['section'];
type AdminRecordSearchParamSection =
    (typeof contracts)['POST /api/v1/admin/{section}/search']['params']['_output']['section'];
type AdminRecordSearchSuccessSection = Success<'POST /api/v1/admin/{section}/search'>['data']['section'];

void test('bounded billing and governance section types exactly match their generated GET route params', () => {
    const billingParity: Equal<BillingSection, BillingWireSection> = true;
    const governanceParity: Equal<GovernanceSection, GovernanceWireSection> = true;
    assert.deepEqual({ billingParity, governanceParity }, { billingParity: true, governanceParity: true });
});

void test('admin record section is the generated generic search contract and navigation differs only by releases', () => {
    const paramsParity: Equal<AdminRecordSection, AdminRecordSearchParamSection> = true;
    const successParity: Equal<AdminRecordSection, AdminRecordSearchSuccessSection> = true;
    const navigationParity: Equal<Section, AdminRecordSection | 'releases'> = true;
    assert.deepEqual(
        { paramsParity, successParity, navigationParity },
        { paramsParity: true, successParity: true, navigationParity: true },
    );
});

void test('admin record keys and presentation preserve exact section semantics', () => {
    assert.deepEqual(adminRecordKeys.filters('session-1', 'users'), ['admin-record', 'session-1', 'filters', 'users']);
    assert.deepEqual(adminRecordKeys.related('session-1', 'support', 'ticket-1', 'messages'), [
        'admin-record',
        'session-1',
        'related',
        'support',
        'ticket-1',
        'messages',
    ]);
    const item = {
        id: '00000000-0000-4000-8000-000000000001',
        title: '00000000-0000-4000-8000-000000000001',
        status: null,
        updatedAt: null,
        version: '1',
        fields: [],
        related: [],
        actions: [],
    } satisfies AdminRecord;
    assert.equal(recordTitle(item, 'users'), 'Пользователь · 00000001');
    assert.equal(recordTitle(item, 'catalog'), 'Запись · 00000001');
});

void test('bounded entity section contracts do not depend on navigation entity internals', async () => {
    const [billing, governance] = await Promise.all([
        readFile(resolve('src/entities/billing-account/query-keys.ts'), 'utf8'),
        readFile(resolve('src/entities/user-access/query-keys.ts'), 'utf8'),
    ]);
    assert.doesNotMatch(billing, /admin-section/u);
    assert.doesNotMatch(governance, /admin-section/u);
    assert.match(billing, /export type BillingSection = 'users' \| 'subscriptions' \| 'payments'/u);
    assert.match(governance, /export type GovernanceSection = 'users' \| 'sanctions' \| 'access'/u);
});

void test('admin record entity is navigation-independent and feature rejects only releases at its boundary', async () => {
    const [model, queryKeys, presentation, page, app] = await Promise.all([
        readFile(resolve('src/entities/admin-record/model.ts'), 'utf8'),
        readFile(resolve('src/entities/admin-record/query-keys.ts'), 'utf8'),
        readFile(resolve('src/entities/admin-record/presentation.ts'), 'utf8'),
        readFile(resolve('src/features/admin-record/page.tsx'), 'utf8'),
        readFile(resolve('src/app/app.tsx'), 'utf8'),
    ]);
    assert.doesNotMatch(`${model}\n${queryKeys}\n${presentation}`, /admin-section/u);
    assert.match(model, /POST \/api\/v1\/admin\/\{section\}\/search/u);
    assert.match(page, /return section === 'releases' \? undefined : section/u);
    assert.match(
        page,
        /const section = navigationSection \? toAdminRecordSection\(navigationSection\.id\) : undefined/u,
    );
    assert.equal(appRouteManifest.length, 29);
    assert.match(app, /<Route path="\/admin\/releases" element=\{<ReleasesPage \/>\} \/>/u);
    assert.match(app, /<Route path="\/admin\/:section" element=\{<AdminRecordPage \/>\} \/>/u);
});
