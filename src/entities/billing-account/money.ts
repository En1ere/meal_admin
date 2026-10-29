const minorUnitsPattern = /^\d+$/u;

export function parseMinorUnits(value: string): bigint | null {
    return value.length <= 128 && minorUnitsPattern.test(value) ? BigInt(value) : null;
}

export function formatRublesFromMinor(value: string): string {
    const amount = parseMinorUnits(value);
    if (amount === null) return 'Некорректная сумма';
    return `${amount / 100n},${String(amount % 100n).padStart(2, '0')} ₽`;
}

export function availableRefundMinor(payment: { paidMinor: string; returnedMinor: string; reservedMinor: string }): {
    availableMinor: string | null;
    isConsistent: boolean;
} {
    const paid = parseMinorUnits(payment.paidMinor);
    const returned = parseMinorUnits(payment.returnedMinor);
    const reserved = parseMinorUnits(payment.reservedMinor);
    if (paid === null || returned === null || reserved === null) return { availableMinor: null, isConsistent: false };
    const available = paid - returned - reserved;
    if (available < 0n) return { availableMinor: null, isConsistent: false };
    return { availableMinor: String(available), isConsistent: true };
}
