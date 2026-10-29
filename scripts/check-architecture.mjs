import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const sourceRoot = path.resolve('src');
const authFeatureRoot = path.join(sourceRoot, 'features', 'auth');
const adminRecordFeatureRoot = path.join(sourceRoot, 'features', 'admin-record');
const adminRecordEntityRoot = path.join(sourceRoot, 'entities', 'admin-record');
const supportFeatureRoot = path.join(sourceRoot, 'features', 'support');
const supportTicketEntityRoot = path.join(sourceRoot, 'entities', 'support-ticket');
const userGovernanceFeatureRoot = path.join(sourceRoot, 'features', 'user-governance');
const userAccessEntityRoot = path.join(sourceRoot, 'entities', 'user-access');
const billingFeatureRoot = path.join(sourceRoot, 'features', 'billing');
const billingAccountEntityRoot = path.join(sourceRoot, 'entities', 'billing-account');
const reviewFeatureRoot = path.join(sourceRoot, 'features', 'review');
const complianceReviewEntityRoot = path.join(sourceRoot, 'entities', 'compliance-review');
const contentFeatureRoot = path.join(sourceRoot, 'features', 'content');
const contentWorkflowEntityRoot = path.join(sourceRoot, 'entities', 'content-workflow');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const layeredRoots = new Set(['app', 'widgets', 'features', 'entities', 'shared']);
const importPattern = /(?:from\s*|import\s*)['"]([^'"]+)['"]/gu;

async function collect(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map(async (entry) => {
            const absolute = path.join(directory, entry.name);
            if (entry.isDirectory()) return collect(absolute);
            return sourceExtensions.has(path.extname(entry.name)) ? [absolute] : [];
        }),
    );
    return nested.flat();
}

const relative = (absolute) => path.relative(sourceRoot, absolute).split(path.sep).join('/');
const layerOf = (absolute) => {
    const [root] = relative(absolute).split('/');
    return layeredRoots.has(root) ? root : null;
};

function layerViolation(sourceLayer, targetLayer) {
    if (!sourceLayer || !targetLayer) return null;
    if (sourceLayer !== 'app' && targetLayer === 'app') return 'only app may depend on app';
    if (sourceLayer === 'shared' && ['entities', 'features', 'widgets'].includes(targetLayer))
        return 'shared must not depend on upper layers';
    if (sourceLayer === 'entities' && ['features', 'widgets'].includes(targetLayer))
        return 'entities must not depend on features or widgets';
    if (sourceLayer === 'features' && targetLayer === 'widgets') return 'features must not depend on widgets';
    return null;
}

const failures = [];
for (const file of await collect(sourceRoot)) {
    const relativeFile = relative(file);
    if (relativeFile.startsWith('ui/')) {
        failures.push(`${relativeFile}: legacy src/ui is forbidden; use shared/ui or widgets`);
        continue;
    }
    const sourceLayer = layerOf(file);
    const source = await readFile(file, 'utf8');
    if (sourceLayer !== 'app' && /app\/providers(?:\.js)?['"]/u.test(source))
        failures.push(`${relativeFile}: runtime must be consumed through shared/runtime`);
    if (/ui\/ThemeControl\/ThemeControl(?:\.js)?['"]/u.test(source))
        failures.push(`${relativeFile}: theme control belongs to shared/ui`);
    if (/features\/auth\/use-request-signal(?:\.js)?['"]/u.test(source))
        failures.push(`${relativeFile}: transport cancellation belongs to shared/api`);
    if (/features\/auth\/session(?:\.js)?['"]/u.test(source))
        failures.push(`${relativeFile}: session guarding belongs to widgets/session-guard`);
    if (/features\/admin\/admin-shell(?:\.js)?['"]/u.test(source))
        failures.push(`${relativeFile}: admin shell belongs to widgets/admin-shell`);
    if (/features\/admin\/navigation(?:\.js)?['"]/u.test(source))
        failures.push(`${relativeFile}: admin section navigation belongs to entities/admin-section`);
    if (/features\/admin\/display-values(?:\.js)?['"]/u.test(source))
        failures.push(`${relativeFile}: admin record presentation belongs to entities/admin-record`);
    if (/features\/admin\/admin-page(?:\.js)?['"]/u.test(source))
        failures.push(`${relativeFile}: generic admin record pages belong to widgets/admin-record-page`);
    if (/features\/admin\/support-(?:conversation|workspace)(?:\.js)?['"]/u.test(source))
        failures.push(`${relativeFile}: support workflows belong to features/support`);
    if (/features\/(?:governance\/governance-actions|free-ai\/free-ai-workspace)(?:\.js)?['"]/u.test(source))
        failures.push(`${relativeFile}: access and Free AI workflows belong to features/user-governance`);
    if (/features\/billing\/billing-workspace(?:\.js)?['"]/u.test(source))
        failures.push(`${relativeFile}: consume billing through its client public API`);
    if (
        /features\/review\/(?:account-deletion-review|review-panel|review-workspace|contracts)(?:\.js)?['"]/u.test(
            source,
        )
    )
        failures.push(`${relativeFile}: consume compliance review through its client public API`);
    if (/features\/content\/(?:content-panel|content-workspace|contracts)(?:\.js)?['"]/u.test(source))
        failures.push(`${relativeFile}: consume content workflow through its client public API`);
    if (sourceLayer === 'app' && /features\/admin-record\//u.test(source))
        failures.push(`${relativeFile}: app must compose admin record pages through widgets/admin-record-page`);
    if (
        !relativeFile.startsWith('entities/admin-record/') &&
        /\[\s*['"]admin-(?:detail|related|filters)['"]/u.test(source)
    )
        failures.push(`${relativeFile}: admin record query keys belong to entities/admin-record`);
    if (
        !relativeFile.startsWith('entities/support-ticket/') &&
        /\[\s*['"]admin-support-(?:workspace|messages)['"]/u.test(source)
    )
        failures.push(`${relativeFile}: support query keys belong to entities/support-ticket`);
    if (!relativeFile.startsWith('entities/user-access/') && /\[\s*['"]admin-(?:governance|free-ai)['"]/u.test(source))
        failures.push(`${relativeFile}: user governance query keys belong to entities/user-access`);
    if (!relativeFile.startsWith('entities/billing-account/') && /\[\s*['"]admin-billing['"]/u.test(source))
        failures.push(`${relativeFile}: billing query keys belong to entities/billing-account`);
    if (!relativeFile.startsWith('entities/compliance-review/') && /\[\s*['"]admin-review['"]/u.test(source))
        failures.push(`${relativeFile}: compliance review query keys belong to entities/compliance-review`);
    if (!relativeFile.startsWith('entities/content-workflow/') && /\[\s*['"]admin-content['"]/u.test(source))
        failures.push(`${relativeFile}: content workflow query keys belong to entities/content-workflow`);

    for (const match of source.matchAll(importPattern)) {
        const specifier = match[1];
        if (!specifier?.startsWith('.')) continue;
        const target = path.resolve(path.dirname(file), specifier);
        const targetLayer = layerOf(target);
        const reason = layerViolation(sourceLayer, targetLayer);
        if (reason) failures.push(`${relativeFile} -> ${specifier}: ${reason}`);

        const targetParts = relative(target).split('/');
        const sourceParts = relativeFile.split('/');
        if (
            file.startsWith(`${adminRecordFeatureRoot}${path.sep}`) &&
            targetParts[0] === 'features' &&
            targetParts[1] !== 'admin-record'
        )
            failures.push(`${relativeFile} -> ${specifier}: generic admin records must use extension slots`);
        if (
            sourceLayer === 'features' &&
            targetParts[0] === 'features' &&
            sourceParts[1] !== targetParts[1] &&
            specifier.endsWith('.module.css')
        )
            failures.push(`${relativeFile} -> ${specifier}: feature CSS Modules are private to their domain`);

        if (sourceParts[0] === 'mocks' && targetParts[0] === 'features')
            failures.push(
                `${relativeFile} -> ${specifier}: mocks-to-features imports are forbidden; move contracts below UI`,
            );
        if (
            !file.startsWith(`${authFeatureRoot}${path.sep}`) &&
            target.startsWith(`${authFeatureRoot}${path.sep}`) &&
            ![path.join(authFeatureRoot, 'client.js'), path.join(authFeatureRoot, 'access-client.js')].includes(target)
        )
            failures.push(`${relativeFile} -> ${specifier}: consume auth through its client public API`);
        if (
            !file.startsWith(`${supportFeatureRoot}${path.sep}`) &&
            target.startsWith(`${supportFeatureRoot}${path.sep}`) &&
            target !== path.join(supportFeatureRoot, 'client.js')
        )
            failures.push(`${relativeFile} -> ${specifier}: consume support through its client public API`);
        if (
            !file.startsWith(`${userGovernanceFeatureRoot}${path.sep}`) &&
            target.startsWith(`${userGovernanceFeatureRoot}${path.sep}`) &&
            target !== path.join(userGovernanceFeatureRoot, 'client.js')
        )
            failures.push(`${relativeFile} -> ${specifier}: consume user governance through its client public API`);
        if (
            !file.startsWith(`${billingFeatureRoot}${path.sep}`) &&
            target.startsWith(`${billingFeatureRoot}${path.sep}`) &&
            target !== path.join(billingFeatureRoot, 'client.js')
        )
            failures.push(`${relativeFile} -> ${specifier}: consume billing through its client public API`);
        if (
            !file.startsWith(`${reviewFeatureRoot}${path.sep}`) &&
            target.startsWith(`${reviewFeatureRoot}${path.sep}`) &&
            target !== path.join(reviewFeatureRoot, 'client.js')
        )
            failures.push(`${relativeFile} -> ${specifier}: consume compliance review through its client public API`);
        if (
            !file.startsWith(`${contentFeatureRoot}${path.sep}`) &&
            target.startsWith(`${contentFeatureRoot}${path.sep}`) &&
            target !== path.join(contentFeatureRoot, 'client.js')
        )
            failures.push(`${relativeFile} -> ${specifier}: consume content workflow through its client public API`);
        if (
            sourceParts[0] !== 'entities' &&
            sourceParts[0] !== 'test' &&
            target.startsWith(`${adminRecordEntityRoot}${path.sep}`) &&
            target !== path.join(adminRecordEntityRoot, 'index.js')
        )
            failures.push(`${relativeFile} -> ${specifier}: consume admin records through their entity public API`);
        if (
            sourceParts[0] !== 'entities' &&
            sourceParts[0] !== 'test' &&
            target.startsWith(`${supportTicketEntityRoot}${path.sep}`) &&
            target !== path.join(supportTicketEntityRoot, 'index.js')
        )
            failures.push(`${relativeFile} -> ${specifier}: consume support tickets through their entity public API`);
        if (
            sourceParts[0] !== 'entities' &&
            sourceParts[0] !== 'test' &&
            target.startsWith(`${userAccessEntityRoot}${path.sep}`) &&
            target !== path.join(userAccessEntityRoot, 'index.js')
        )
            failures.push(`${relativeFile} -> ${specifier}: consume user access through its entity public API`);
        if (
            sourceParts[0] !== 'entities' &&
            sourceParts[0] !== 'test' &&
            target.startsWith(`${billingAccountEntityRoot}${path.sep}`) &&
            target !== path.join(billingAccountEntityRoot, 'index.js')
        )
            failures.push(`${relativeFile} -> ${specifier}: consume billing accounts through their entity public API`);
        if (
            sourceParts[0] !== 'entities' &&
            sourceParts[0] !== 'test' &&
            target.startsWith(`${complianceReviewEntityRoot}${path.sep}`) &&
            target !== path.join(complianceReviewEntityRoot, 'index.js')
        )
            failures.push(`${relativeFile} -> ${specifier}: consume compliance review through its entity public API`);
        if (
            sourceParts[0] !== 'entities' &&
            sourceParts[0] !== 'test' &&
            target.startsWith(`${contentWorkflowEntityRoot}${path.sep}`) &&
            target !== path.join(contentWorkflowEntityRoot, 'index.js')
        )
            failures.push(`${relativeFile} -> ${specifier}: consume content workflow through its entity public API`);
    }
}

if (failures.length) {
    console.error(['Architecture boundary violations:', ...failures.map((item) => `- ${item}`)].join('\n'));
    process.exitCode = 1;
} else {
    console.log('Architecture boundaries are valid; no mock-to-feature debt remains.');
}
