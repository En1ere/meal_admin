import { configureAllergenAssetAdapter } from '../shared/api/development-adapters.js';

export async function prepareApiMode() {
    if (import.meta.env.VITE_API_MODE === 'mock') {
        if (!import.meta.env.DEV) throw new Error('Browser mocks are development-only');
        const [{ startBrowserMocks }, { registerAllergenAsset }] = await Promise.all([
            import('../mocks/browser.js'),
            import('../mocks/allergen-assets.js'),
        ]);
        configureAllergenAssetAdapter(registerAllergenAsset);
        await startBrowserMocks();
        return;
    }
    configureAllergenAssetAdapter(null);
    if (!('serviceWorker' in navigator)) return;
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations)
        if (registration.active?.scriptURL.endsWith('/mockServiceWorker.js')) await registration.unregister();
    if (navigator.serviceWorker.controller?.scriptURL.endsWith('/mockServiceWorker.js')) {
        window.location.reload();
        return false;
    }
}
