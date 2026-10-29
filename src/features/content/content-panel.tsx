import { useCallback } from 'react';
import type { ContentCommand, ContentResult, ContentSection } from '../../entities/content-workflow/index.js';
import { useRuntime } from '../../shared/runtime/index.js';
import { ContentWorkspace } from './content-workspace.js';

export function ContentPanel({ section, id }: { section: ContentSection; id: string }) {
    const { api } = useRuntime();
    const request = useCallback(
        async (command: ContentCommand, signal?: AbortSignal): Promise<ContentResult> => {
            if (!api) throw new Error('Подключение не готово');
            if (command.action === 'load')
                return (
                    await api.request('GET /api/v1/admin/content-workspace/{section}/{id}', undefined, signal, {
                        section,
                        id,
                    })
                ).data;
            return (
                await api.request(
                    `POST /api/v1/admin/content-workspace/{section}/{id}/${command.action}`,
                    command.data,
                    signal,
                    { section, id },
                )
            ).data;
        },
        [api, section, id],
    );
    return <ContentWorkspace section={section} id={id} api={api ? request : null} />;
}
