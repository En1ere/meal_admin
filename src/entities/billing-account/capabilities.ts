type BillingPeriod = {
    source: 'paid' | 'gift';
    endsAt: string;
    revoked: boolean;
};

type BillingState = {
    frozen: boolean;
    periods: BillingPeriod[];
};

export function deriveBillingCapabilities(data: BillingState, now = Date.now()) {
    const activePeriods = data.periods.filter((period) => !period.revoked && Date.parse(period.endsAt) > now);
    const activeGiftPeriods = activePeriods.filter((period) => period.source === 'gift');
    const hasFutureCoverage = activePeriods.length > 0;
    return {
        canGrant: !data.frozen && !hasFutureCoverage,
        canExtend: !data.frozen && hasFutureCoverage,
        canFreeze: !data.frozen && hasFutureCoverage,
        canUnfreeze: data.frozen,
        canRevokeGift: activeGiftPeriods.length > 0,
    } as const;
}
