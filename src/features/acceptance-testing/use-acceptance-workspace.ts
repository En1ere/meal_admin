import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { acceptanceTestKeys, type AcceptanceWorkspace } from '../../entities/acceptance-test/index.js';
import { ApiError } from '../../shared/api/client.js';
import { useRequestSignal } from '../../shared/api/use-request-signal.js';
import { useRuntime } from '../../shared/runtime/index.js';
import type { AcceptanceResetCommand, AcceptanceSaveCommand } from './draft-model.js';

type Attempt =
    | { kind: 'save'; caseId: string; fingerprint: string; command: AcceptanceSaveCommand }
    | { kind: 'reset'; caseId: string; fingerprint: string; command: AcceptanceResetCommand };

export type AcceptanceMutationFailure = {
    kind: 'forbidden' | 'conflict' | 'validation' | 'unknown';
    message: string;
} | null;

export function useAcceptanceWorkspace(sessionId: string | undefined) {
    const { api, queryClient } = useRuntime();
    const begin = useRequestSignal();
    const attempt = useRef<Attempt | null>(null);
    const lock = useRef(false);
    const [pending, setPending] = useState(false);
    const [failure, setFailure] = useState<AcceptanceMutationFailure>(null);
    const queryKey = acceptanceTestKeys.workspace(sessionId ?? 'pending');
    const query = useQuery({
        queryKey,
        enabled: !!api && !!sessionId,
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        queryFn: async ({ signal }) => {
            if (!api) throw new Error('API not ready');
            return (await api.request('GET /api/v1/admin/acceptance-tests', undefined, signal)).data;
        },
    });

    async function refresh() {
        await queryClient.invalidateQueries({ queryKey: acceptanceTestKeys.root });
        const current = queryClient.getQueryData<AcceptanceWorkspace>(queryKey);
        return current ?? null;
    }

    function readResult(workspace: AcceptanceWorkspace | null, caseId: string) {
        return workspace?.groups.flatMap((group) => group.cases).find((item) => item.id === caseId)?.result ?? null;
    }

    function reconciled(workspace: AcceptanceWorkspace | null, frozen: Attempt) {
        const result = readResult(workspace, frozen.caseId);
        if (!result || result.version <= frozen.command.expectedVersion) return false;
        return frozen.kind === 'save'
            ? result.status === frozen.command.status && result.comment === frozen.command.comment
            : result.status === 'not_tested';
    }

    async function execute(next: Attempt): Promise<boolean> {
        if (!api || lock.current) return false;
        if (attempt.current && attempt.current.fingerprint !== next.fingerprint) {
            setFailure({
                kind: 'unknown',
                message: 'Исход предыдущего сохранения неизвестен. Сначала повторите его без изменений.',
            });
            return false;
        }
        attempt.current ??= next;
        const frozen = attempt.current;
        lock.current = true;
        setPending(true);
        setFailure(null);
        try {
            const signal = begin();
            if (frozen.kind === 'save') {
                await api.request('PUT /api/v1/admin/acceptance-tests/{caseId}', frozen.command, signal, {
                    caseId: frozen.caseId,
                });
            } else {
                await api.request('POST /api/v1/admin/acceptance-tests/{caseId}/reset', frozen.command, signal, {
                    caseId: frozen.caseId,
                });
            }
            attempt.current = null;
            await refresh();
            return true;
        } catch (caught) {
            if (caught instanceof ApiError && (caught.status === 409 || caught.status === 412)) {
                attempt.current = null;
                await refresh();
                setFailure({
                    kind: 'conflict',
                    message:
                        'Кейс уже изменён другим администратором. Показана актуальная версия; ваш черновик сохранён.',
                });
                return false;
            }
            if (caught instanceof ApiError && caught.status < 500) {
                attempt.current = null;
                setFailure({
                    kind: caught.status === 403 ? 'forbidden' : 'validation',
                    message:
                        caught.status === 403
                            ? 'У вашей учётной записи нет права изменять результаты приёмки.'
                            : caught.message,
                });
                return false;
            }
            const current = await refresh();
            if (reconciled(current, frozen)) {
                attempt.current = null;
                setFailure(null);
                return true;
            }
            setFailure({
                kind: 'unknown',
                message: 'Исход сохранения неизвестен. Повтор отправит ту же команду с тем же ключом операции.',
            });
            return false;
        } finally {
            lock.current = false;
            setPending(false);
        }
    }

    return {
        query,
        pending,
        failure,
        hasFrozenAttempt: !!attempt.current,
        retryFrozen: async () => (attempt.current ? execute(attempt.current) : false),
        clearFailure: () => setFailure(null),
        save: (caseId: string, command: AcceptanceSaveCommand, fingerprint: string) =>
            execute({ kind: 'save', caseId, command, fingerprint: `save:${caseId}:${fingerprint}` }),
        reset: (caseId: string, command: AcceptanceResetCommand) =>
            execute({
                kind: 'reset',
                caseId,
                command,
                fingerprint: `reset:${caseId}:${command.expectedVersion}`,
            }),
    };
}
