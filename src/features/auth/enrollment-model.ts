const singleValue = (url: URL, name: string) => {
    const values = url.searchParams.getAll(name);
    return values.length === 1 ? values[0]! : null;
};

export function safeOtpAuthUri(value: string, expectedSecret: string) {
    try {
        if (!expectedSecret) return null;
        const url = new URL(value);
        if (
            url.protocol !== 'otpauth:' ||
            url.hostname !== 'totp' ||
            url.username ||
            url.password ||
            url.port ||
            url.hash
        )
            return null;

        const label = decodeURIComponent(url.pathname.slice(1)).trim();
        if (!label || /[\u0000-\u001f\u007f]/u.test(label)) return null;

        const secret = singleValue(url, 'secret');
        const issuer = singleValue(url, 'issuer');
        const algorithmValues = url.searchParams.getAll('algorithm');
        const digitsValues = url.searchParams.getAll('digits');
        const periodValues = url.searchParams.getAll('period');
        if (
            secret !== expectedSecret ||
            issuer !== 'Meal Planner' ||
            algorithmValues.length > 1 ||
            digitsValues.length > 1 ||
            periodValues.length > 1
        )
            return null;

        const algorithm = algorithmValues[0]?.toUpperCase() ?? 'SHA1';
        const digits = digitsValues[0] ?? '6';
        const period = periodValues[0] ?? '30';
        if (algorithm !== 'SHA1' || digits !== '6' || period !== '30') return null;

        const normalized = new URL(`otpauth://totp/${encodeURIComponent(label)}`);
        normalized.searchParams.set('secret', expectedSecret);
        normalized.searchParams.set('issuer', 'Meal Planner');
        normalized.searchParams.set('algorithm', 'SHA1');
        normalized.searchParams.set('digits', '6');
        normalized.searchParams.set('period', '30');
        return normalized.toString();
    } catch {
        return null;
    }
}

export function formatRecoveryCodes(codes: readonly string[]) {
    return codes.join('\n');
}
