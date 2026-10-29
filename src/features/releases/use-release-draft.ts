import { useEffect, useMemo, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../shared/api/client.js';
import { ApiError } from '../../shared/api/client.js';
import { adminReleaseDraftKey } from '../../shared/storage/private-cache.js';
import type { Release, ReleaseChange } from './contracts.js';
import { runReleaseCommand, serializeChanges } from './api.js';
import { checksum, releaseWorkspaceKey } from './workspace.js';
import { readReleaseDraftCache, type ReleaseDraftCache } from './release-model.js';

export function useReleaseDraft(server: Release | undefined, api: ApiClient | null, queryClient: QueryClient) {
    const [title, setTitle] = useState('');
    const [changes, setChanges] = useState<ReleaseChange[]>([]);
    const [baseVersion, setBaseVersion] = useState(0);
    const [clientRevision, setClientRevision] = useState(0);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'local' | 'saving' | 'saved' | 'conflict'>('idle');
    const [error, setError] = useState('');
    const initializedRef = useRef('');
    const [hydratedRevision, setHydratedRevision] = useState('');
    const serverRevision = server ? `${server.id}:${server.version}:${server.clientRevision}` : '';
    useEffect(() => {
        if (!server) return;
        const revision = serverRevision;
        if (initializedRef.current === revision) return;
        if (initializedRef.current && ['local', 'saving', 'conflict'].includes(saveStatus)) return;
        initializedRef.current = revision;
        const cached = readReleaseDraftCache(server);
        setTitle(cached?.patch.title ?? server.title);
        setChanges(cached?.patch.changes ?? server.changes);
        setBaseVersion(cached?.baseVersion ?? server.version);
        setClientRevision(cached?.clientRevision ?? server.clientRevision);
        setSaveStatus(cached ? 'local' : 'saved');
        setHydratedRevision(revision);
    }, [saveStatus, server, serverRevision]);
    const patch = useMemo(() => ({ title, changes }), [title, changes]);
    const dirty =
        !!server &&
        JSON.stringify({ title: patch.title, patches: serializeChanges(patch.changes) }) !==
            JSON.stringify({ title: server.title, patches: serializeChanges(server.changes) });
    useEffect(() => {
        if (
            !server ||
            hydratedRevision !== serverRevision ||
            server.status === 'published' ||
            !dirty ||
            saveStatus === 'conflict'
        )
            return;
        const nextRevision = clientRevision + 1;
        let timer = 0;
        let cancelled = false;
        void (async () => {
            const sum = await checksum({
                name: patch.title,
                patches: serializeChanges(patch.changes),
                clientRevision: nextRevision,
            });
            if (cancelled) return;
            const cached: ReleaseDraftCache = {
                releaseId: server.id,
                baseVersion,
                clientRevision: nextRevision,
                checksum: sum,
                patch,
            };
            try {
                sessionStorage.setItem(adminReleaseDraftKey, JSON.stringify(cached));
            } catch {
                /* optional safety cache */
            }
            setSaveStatus('local');
            timer = window.setTimeout(
                () =>
                    void (async () => {
                        if (!api) return;
                        setSaveStatus('saving');
                        try {
                            const result = await runReleaseCommand(api, { action: 'save', ...cached });
                            queryClient.setQueryData(releaseWorkspaceKey, result.workspace);
                            if (result.ack?.clientRevision === nextRevision && result.ack.checksum === sum) {
                                try {
                                    sessionStorage.removeItem(adminReleaseDraftKey);
                                } catch {
                                    /* optional safety cache */
                                }
                                setBaseVersion(result.ack.baseVersion);
                                setClientRevision(nextRevision);
                                setSaveStatus('saved');
                            }
                        } catch (failure) {
                            if (failure instanceof ApiError && failure.status === 409) setSaveStatus('conflict');
                            else {
                                setSaveStatus('local');
                                setError(
                                    failure instanceof ApiError
                                        ? failure.message
                                        : 'Автосохранение не удалось. Локальная копия сохранена.',
                                );
                            }
                        }
                    })(),
                900,
            );
        })();
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [
        api,
        baseVersion,
        clientRevision,
        dirty,
        hydratedRevision,
        patch,
        queryClient,
        saveStatus,
        server,
        serverRevision,
    ]);
    return {
        title,
        setTitle,
        changes,
        setChanges,
        baseVersion,
        setBaseVersion,
        clientRevision,
        setClientRevision,
        saveStatus,
        setSaveStatus,
        error,
        setError,
        dirty,
        initializedRef,
        setHydratedRevision,
    };
}
