import type { AcceptanceCase, AcceptanceGroup, AcceptanceStatus, AcceptanceWorkspace } from './model.js';

export const acceptanceStatusLabels: Record<AcceptanceStatus, string> = {
    not_tested: 'Не проверено',
    passed: 'Пройдено',
    partial: 'Частично',
    failed: 'Не пройдено',
};

export const acceptanceStatusDescriptions: Record<AcceptanceStatus, string> = {
    not_tested: 'Ещё не проверялось',
    passed: 'Работает как ожидается',
    partial: 'Есть замечания',
    failed: 'Не работает',
};

export type AcceptanceFilter = 'all' | AcceptanceStatus;

export function orderedGroups(workspace: AcceptanceWorkspace): AcceptanceGroup[] {
    return [...workspace.groups]
        .sort((left, right) => left.order - right.order)
        .map((group) => ({ ...group, cases: [...group.cases].sort((left, right) => left.order - right.order) }));
}

export function filterAcceptanceGroups(
    groups: AcceptanceGroup[],
    search: string,
    status: AcceptanceFilter,
): AcceptanceGroup[] {
    const query = search.trim().toLocaleLowerCase('ru-RU');
    return groups
        .map((group) => ({
            ...group,
            cases: group.cases.filter((item) => {
                const matchesStatus = status === 'all' || item.result.status === status;
                const matchesSearch =
                    !query ||
                    item.id.toLocaleLowerCase('ru-RU').includes(query) ||
                    item.title.toLocaleLowerCase('ru-RU').includes(query) ||
                    item.steps.some((step) => step.toLocaleLowerCase('ru-RU').includes(query));
                return matchesStatus && matchesSearch;
            }),
        }))
        .filter((group) => group.cases.length > 0);
}

export function flattenAcceptanceCases(groups: AcceptanceGroup[]): AcceptanceCase[] {
    return groups.flatMap((group) => group.cases);
}

export function adjacentAcceptanceCase(
    cases: AcceptanceCase[],
    selectedId: string,
    direction: -1 | 1,
): AcceptanceCase | null {
    const index = cases.findIndex((item) => item.id === selectedId);
    if (index < 0) return cases[0] ?? null;
    return cases[index + direction] ?? null;
}

export function groupProgress(group: AcceptanceGroup) {
    const completed = group.cases.filter((item) => item.result.status !== 'not_tested').length;
    return { completed, total: group.cases.length };
}

export function formatAcceptanceDate(value: string | null | undefined) {
    if (!value) return 'Ещё не обновлялось';
    return new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export function checkedByLabel(value: AcceptanceCase['result']['checkedBy']) {
    return value?.displayName?.trim() || value?.login || 'Ещё никто';
}
