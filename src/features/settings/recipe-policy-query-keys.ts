export const recipePolicyKeys = {
    forPrincipal: (principalId: string | undefined) => ['recipe-policy', principalId] as const,
};
