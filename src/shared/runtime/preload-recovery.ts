const markerPrefix = 'meal-admin:vite-preload-recovery';

type RecoveryStorage = Pick<Storage, 'getItem' | 'setItem'>;
type RecoveryTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

export interface VitePreloadRecoveryOptions {
    appVersion: string;
    getLocation: () => string;
    reload: () => void;
    storage: RecoveryStorage;
    target: RecoveryTarget;
}

export function vitePreloadRecoveryMarker(appVersion: string, location: string) {
    return `${markerPrefix}:${appVersion}:${location}`;
}

function claimRecovery(storage: RecoveryStorage, marker: string) {
    try {
        if (storage.getItem(marker) === 'attempted') return false;
        storage.setItem(marker, 'attempted');
        return true;
    } catch {
        // Without durable tab-scoped state an automatic reload could loop forever.
        return false;
    }
}

export function installVitePreloadRecovery({
    appVersion,
    getLocation,
    reload,
    storage,
    target,
}: VitePreloadRecoveryOptions) {
    const onPreloadError = (event: Event) => {
        const marker = vitePreloadRecoveryMarker(appVersion, getLocation());
        if (!claimRecovery(storage, marker)) return;
        event.preventDefault();
        reload();
    };
    target.addEventListener('vite:preloadError', onPreloadError);
    return () => target.removeEventListener('vite:preloadError', onPreloadError);
}

export function installBrowserVitePreloadRecovery() {
    const configuredVersion: unknown = import.meta.env.VITE_APP_VERSION;
    const appVersion =
        typeof configuredVersion === 'string' && configuredVersion.trim() ? configuredVersion.trim() : 'unknown';
    return installVitePreloadRecovery({
        appVersion,
        getLocation: () => window.location.href,
        reload: () => window.location.reload(),
        storage: window.sessionStorage,
        target: window,
    });
}
