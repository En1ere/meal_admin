import { contracts, errorSchema, type Route, type Success } from './contracts.generated.js';
import { getAdminUnlock, setAdminUnlock } from '../auth/unlock.js';

export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
        readonly requestId: string,
    ) {
        super(message);
    }
}
export class ApiClient {
    private csrf: string | undefined;
    private csrfRequest: Promise<string> | undefined;
    private epoch = 0;
    private controller = new AbortController();
    private authenticated = false;
    private rejectionReported = false;
    private adminContentRevisionAxes: boolean | undefined;
    constructor(
        private readonly origin: string,
        private readonly transport: typeof fetch = fetch,
        private readonly onSessionRejected?: (error: ApiError) => void,
    ) {}
    // Call on logout/account/scope change before committing new private state.
    invalidate() {
        this.epoch++;
        this.controller.abort();
        this.controller = new AbortController();
        this.csrf = undefined;
        this.csrfRequest = undefined;
        this.authenticated = false;
        this.adminContentRevisionAxes = undefined;
    }
    private prepareRequestBody(route: Route, body: unknown): unknown {
        if (
            route !== 'POST /api/v1/admin/content-workspace/{section}/{id}/moderate' ||
            this.adminContentRevisionAxes === true ||
            !body ||
            typeof body !== 'object' ||
            Array.isArray(body)
        )
            return body;
        const legacyBody = { ...(body as Record<string, unknown>) };
        delete legacyBody.publicReason;
        return legacyBody;
    }
    private normalizeAdminContentSuccess(
        route: Route,
        value: unknown,
    ): { value: unknown; adminContentRevisionAxes?: boolean } {
        if (
            !route.startsWith('GET /api/v1/admin/content-workspace/') &&
            !route.startsWith('POST /api/v1/admin/content-workspace/')
        )
            return { value };
        if (!value || typeof value !== 'object' || Array.isArray(value)) return { value };
        const envelope = value as Record<string, unknown>;
        const data = envelope.data;
        if (!data || typeof data !== 'object' || Array.isArray(data)) return { value };
        const result = data as Record<string, unknown>;
        const hasReview = Object.hasOwn(result, 'review');
        const hasPublication = Object.hasOwn(result, 'publication');
        if (hasReview && hasPublication) return { value, adminContentRevisionAxes: true };
        if (hasReview || hasPublication) return { value };
        return {
            value: { ...envelope, data: { ...result, review: null, publication: null } },
            adminContentRevisionAxes: false,
        };
    }
    private async csrfToken(): Promise<string> {
        if (this.csrf) return this.csrf;
        if (this.csrfRequest) return this.csrfRequest;
        const epoch = this.epoch;
        const pending = this.request('GET /api/v1/admin/auth/csrf').then((response) => {
            if (epoch !== this.epoch) throw new DOMException('Stale auth context', 'AbortError');
            return (this.csrf = response.data.token);
        });
        this.csrfRequest = pending;
        try {
            return await pending;
        } finally {
            if (this.csrfRequest === pending) this.csrfRequest = undefined;
        }
    }
    async request<R extends Route>(
        route: R,
        body?: unknown,
        signal?: AbortSignal,
        params?: Record<string, string>,
        options?: { query?: Record<string, string> },
    ): Promise<Success<R>> {
        const epoch = this.epoch;
        const contextSignal = this.controller.signal;
        const index = route.indexOf(' ');
        const method = route.slice(0, index);
        let path = route.slice(index + 1);
        const schema = contracts[route];
        if (schema.params) {
            const values: Record<string, string> = schema.params.parse(params);
            path = path.replace(/\{([^}]+)\}/g, (_, name: string) => {
                const value = values[name]!;
                if (value === '.' || value === '..') throw new TypeError('Invalid URL path segment');
                return encodeURIComponent(value);
            });
        }
        const requestBody = this.prepareRequestBody(route, body);
        if (schema.request) schema.request.parse(requestBody);
        const headers: Record<string, string> = {};
        const unlock = getAdminUnlock();
        if (unlock && path.startsWith('/api/v1/admin/')) headers['x-admin-unlock'] = unlock;
        if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers['x-csrf-token'] = await this.csrfToken();
        if (requestBody !== undefined) headers['content-type'] = 'application/json';
        contextSignal.throwIfAborted();
        // Native browser fetch must not receive ApiClient as its receiver.
        const transport = this.transport;
        const url = new URL(path, this.origin);
        for (const [key, value] of Object.entries(options?.query ?? {})) url.searchParams.set(key, value);
        const response = await transport(url, {
            method,
            headers,
            credentials: 'include',
            cache: 'no-store',
            signal: signal ? AbortSignal.any([signal, contextSignal]) : contextSignal,
            ...(requestBody !== undefined ? { body: JSON.stringify(requestBody) } : {}),
        });
        const value: unknown = await response.json();
        if (epoch !== this.epoch || contextSignal.aborted || signal?.aborted)
            throw new DOMException('Stale API response', 'AbortError');
        if (!response.ok) {
            const parsed = errorSchema.parse(value);
            const error = new ApiError(response.status, parsed.error.code, parsed.error.message, parsed.meta.requestId);
            const publicAuth = [
                '/api/v1/admin/auth/login',
                '/api/v1/admin/auth/mfa/verify',
                '/api/v1/admin/auth/csrf',
                '/api/v1/admin/auth/unlock',
                '/api/v1/admin/auth/critical-confirm',
            ].includes(path);
            const protectedRequest =
                path.startsWith('/api/v1/admin/') && (!publicAuth || error.code === 'ADMIN_LOCKED');
            if (
                (response.status === 401 || error.code === 'ADMIN_LOCKED') &&
                protectedRequest &&
                !this.rejectionReported &&
                (!['/api/v1/admin/auth/me', '/api/v1/admin/auth/status'].includes(path) ||
                    this.authenticated ||
                    !!unlock)
            ) {
                this.rejectionReported = true;
                setAdminUnlock();
                this.invalidate();
                this.onSessionRejected?.(error);
            }
            throw error;
        }
        // Runtime schema is selected by the same route key as the generic response type.
        const normalized = this.normalizeAdminContentSuccess(route, value);
        const result = schema.success.parse(normalized.value) as Success<R>;
        if (normalized.adminContentRevisionAxes !== undefined)
            this.adminContentRevisionAxes = normalized.adminContentRevisionAxes;
        if (path === '/api/v1/admin/auth/me') {
            this.authenticated = true;
            this.rejectionReported = false;
        }
        return result;
    }
}
