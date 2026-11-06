type AllergenSubjectType = 'ingredient' | 'variant' | 'product';

const root = ['admin', 'allergens'] as const;

export const allergenKeys = {
    root,
    list: () => root,
    detail: (code: string | undefined) => [...root, 'detail', code] as const,
    subjects: (subjectType: AllergenSubjectType, query: string) =>
        ['admin', 'allergen-subjects', subjectType, query] as const,
};
