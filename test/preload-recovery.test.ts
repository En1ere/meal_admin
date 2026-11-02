import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installVitePreloadRecovery, vitePreloadRecoveryMarker } from '../src/shared/runtime/preload-recovery.js';

function memoryStorage() {
    const values = new Map<string, string>();
    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
    };
}

void test('vite preload recovery reloads the same version and location only once', () => {
    const target = new EventTarget();
    const storage = memoryStorage();
    let reloads = 0;
    const dispose = installVitePreloadRecovery({
        appVersion: '0.0.130',
        getLocation: () => 'https://admin.example.test/admin/testing?filter=failed#case',
        reload: () => reloads++,
        storage,
        target,
    });

    const first = new Event('vite:preloadError', { cancelable: true });
    assert.equal(target.dispatchEvent(first), false);
    assert.equal(first.defaultPrevented, true);
    assert.equal(reloads, 1);

    const repeated = new Event('vite:preloadError', { cancelable: true });
    assert.equal(target.dispatchEvent(repeated), true);
    assert.equal(repeated.defaultPrevented, false);
    assert.equal(reloads, 1);
    dispose();
});

void test('vite preload recovery marker is isolated by release and exact location', () => {
    assert.notEqual(
        vitePreloadRecoveryMarker('0.0.130', 'https://admin.example.test/admin/testing'),
        vitePreloadRecoveryMarker('0.0.131', 'https://admin.example.test/admin/testing'),
    );
    assert.notEqual(
        vitePreloadRecoveryMarker('0.0.130', 'https://admin.example.test/admin/testing'),
        vitePreloadRecoveryMarker('0.0.130', 'https://admin.example.test/admin/users'),
    );
});

void test('vite preload recovery reads the current SPA location when the error happens', () => {
    const target = new EventTarget();
    const storage = memoryStorage();
    let location = 'https://admin.example.test/admin';
    let reloads = 0;
    installVitePreloadRecovery({
        appVersion: '0.0.130',
        getLocation: () => location,
        reload: () => reloads++,
        storage,
        target,
    });

    location = 'https://admin.example.test/admin/testing';
    target.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));

    assert.equal(storage.getItem(vitePreloadRecoveryMarker('0.0.130', location)), 'attempted');
    assert.equal(storage.getItem(vitePreloadRecoveryMarker('0.0.130', 'https://admin.example.test/admin')), null);
    assert.equal(reloads, 1);
});

void test('unavailable session storage fails closed without a reload loop', () => {
    const target = new EventTarget();
    let reloads = 0;
    installVitePreloadRecovery({
        appVersion: '0.0.130',
        getLocation: () => 'https://admin.example.test/admin/testing',
        reload: () => reloads++,
        storage: {
            getItem: () => {
                throw new Error('storage unavailable');
            },
            setItem: () => undefined,
        },
        target,
    });
    const event = new Event('vite:preloadError', { cancelable: true });
    assert.equal(target.dispatchEvent(event), true);
    assert.equal(event.defaultPrevented, false);
    assert.equal(reloads, 0);
});
