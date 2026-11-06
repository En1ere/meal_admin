import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const option = (name) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
};

const fixtureMode = process.argv.includes('--fixture');
const sourceRoot = path.resolve(option('--source-root') ?? 'src');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const layeredRoots = new Set(['app', 'widgets', 'features', 'entities', 'shared', 'mocks']);
const appMockCompositionRoots = new Set(['app/api-mode.ts', 'app/app.tsx']);
const removedCompatibilityBarrels = new Set([
    'features/news/contracts.ts',
    'features/operations/contracts.ts',
    'features/releases/contracts.ts',
]);
const removedLegacySliceRoots = ['features/admin/', 'features/free-ai/', 'features/governance/'];

const publicEntryExceptions = new Map([
    ['features/auth', ['features/auth/client.ts', 'features/auth/access-client.ts']],
    ['entities/staff-session', ['entities/staff-session/client.ts']],
    [
        'entities/admin-notification',
        [
            'entities/admin-notification/index.ts',
            'entities/admin-notification/preferences.ts',
            'entities/admin-notification/center-contracts.ts',
            'entities/admin-notification/preferences-query-keys.ts',
            'entities/admin-notification/center-query-keys.ts',
        ],
    ],
    [
        'shared/api',
        [
            'shared/api/client.ts',
            'shared/api/contracts.generated.ts',
            'shared/api/development-adapters.ts',
            'shared/api/use-request-signal.ts',
        ],
    ],
    [
        'shared/auth',
        [
            'shared/auth/routes.ts',
            'shared/auth/unlock.ts',
            'shared/auth/query-keys.ts',
            'shared/auth/admin-status.ts',
            'shared/auth/critical-confirmation.tsx',
        ],
    ],
    ['shared/runtime', ['shared/runtime/index.tsx', 'shared/runtime/preload-recovery.ts']],
    ['shared/storage', ['shared/storage/private-cache.ts']],
    ['shared/telemetry', ['shared/telemetry/browser.ts']],
    ['shared/ui', ['shared/ui/brand.tsx', 'shared/ui/theme-control.tsx']],
]);

const crossSliceDebt = new Set();

const privateImportDebt = new Set();

const cycleDebt = new Set();

const exportStarDebt = new Map();

const literalQueryDebt = new Map();

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
const sliceOf = (absolute) => {
    const [layer, slice] = relative(absolute).split('/');
    if (['widgets', 'features', 'entities', 'shared'].includes(layer) && slice) return `${layer}/${slice}`;
    if (layer === 'app' || layer === 'mocks') return layer;
    return null;
};

function publicEntriesForSlice(slice) {
    const exception = publicEntryExceptions.get(slice);
    if (exception) return exception;
    if (slice.startsWith('features/') || slice.startsWith('widgets/'))
        return [`${slice}/client.ts`, `${slice}/client.tsx`];
    if (slice.startsWith('entities/') || slice.startsWith('shared/'))
        return [`${slice}/index.ts`, `${slice}/index.tsx`];
    return [];
}

function resolveRelativeImport(file, specifier, sourceFiles) {
    const unresolved = path.resolve(path.dirname(file), specifier);
    const candidates = [unresolved];
    const extension = path.extname(unresolved);
    if (extension === '.js' || extension === '.jsx' || extension === '.mjs') {
        const stem = unresolved.slice(0, -extension.length);
        candidates.push(...[...sourceExtensions].map((candidate) => `${stem}${candidate}`));
    } else if (!extension) {
        candidates.push(...[...sourceExtensions].map((candidate) => `${unresolved}${candidate}`));
        candidates.push(...[...sourceExtensions].map((candidate) => path.join(unresolved, `index${candidate}`)));
    }
    return candidates.find((candidate) => sourceFiles.has(path.normalize(candidate))) ?? null;
}

function moduleSpecifiers(file, source) {
    const kind = file.endsWith('.tsx') || file.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
    const specifiers = [];
    let computedDynamicImport = false;
    function visit(node) {
        if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
        )
            specifiers.push(node.moduleSpecifier.text);
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
            if (node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]))
                specifiers.push(node.arguments[0].text);
            else computedDynamicImport = true;
        }
        ts.forEachChild(node, visit);
    }
    visit(parsed);
    return { specifiers, computedDynamicImport };
}

const failures = [];

if (!fixtureMode) {
    const tsconfig = JSON.parse(await readFile(path.resolve('tsconfig.json'), 'utf8'));
    if (tsconfig.compilerOptions?.baseUrl || Object.keys(tsconfig.compilerOptions?.paths ?? {}).length > 0)
        failures.push('tsconfig.json: path aliases are not approved; architecture imports must stay relative');
    const viteConfig = await readFile(path.resolve('vite.config.ts'), 'utf8');
    if (/\balias\s*:/u.test(viteConfig))
        failures.push('vite.config.ts: resolve aliases are not approved until the architecture gate resolves them');
}

const packageManifest = JSON.parse(await readFile(path.resolve('package.json'), 'utf8'));
const declaredPackages = new Set(
    Object.keys({
        ...packageManifest.dependencies,
        ...packageManifest.devDependencies,
        ...packageManifest.optionalDependencies,
        ...packageManifest.peerDependencies,
    }),
);
const isDeclaredPackage = (specifier) =>
    specifier.startsWith('node:') ||
    [...declaredPackages].some((packageName) => specifier === packageName || specifier.startsWith(`${packageName}/`));

const files = await collect(sourceRoot);
const sourceFiles = new Set(files.map((file) => path.normalize(file)));
const sourceByRelative = new Map();
const graph = new Map(files.map((file) => [path.normalize(file), new Set()]));
const slices = new Map();
const observedLiteralQueries = new Map();

for (const file of files) {
    const normalizedFile = path.normalize(file);
    const relativeFile = relative(file);
    const sourceLayer = layerOf(file);
    const sourceSlice = sliceOf(file);
    const source = await readFile(file, 'utf8');
    sourceByRelative.set(relativeFile, source);
    if (sourceSlice && !['app', 'mocks'].includes(sourceSlice)) {
        const members = slices.get(sourceSlice) ?? [];
        members.push(relativeFile);
        slices.set(sourceSlice, members);
    }

    if (removedCompatibilityBarrels.has(relativeFile)) {
        failures.push(`${relativeFile}: compatibility contract barrels are forbidden; consume the entity public API`);
        continue;
    }
    if (removedLegacySliceRoots.some((root) => relativeFile.startsWith(root))) {
        failures.push(`${relativeFile}: removed legacy feature slice must not be recreated`);
        continue;
    }
    if (relativeFile.startsWith('ui/')) {
        failures.push(`${relativeFile}: legacy src/ui is forbidden; use shared/ui or widgets`);
        continue;
    }

    if (sourceLayer !== 'app' && /app\/providers(?:\.js)?["']/u.test(source))
        failures.push(`${relativeFile}: runtime must be consumed through shared/runtime`);
    if (/ui\/ThemeControl\/ThemeControl(?:\.js)?["']/u.test(source))
        failures.push(`${relativeFile}: theme control belongs to shared/ui`);
    if (/features\/auth\/use-request-signal(?:\.js)?["']/u.test(source))
        failures.push(`${relativeFile}: transport cancellation belongs to shared/api`);
    if (/features\/auth\/session(?:\.js)?["']/u.test(source))
        failures.push(`${relativeFile}: session guarding belongs to widgets/session-guard`);
    if (/features\/admin\/(?:admin-shell|navigation|display-values|admin-page)(?:\.js)?["']/u.test(source))
        failures.push(`${relativeFile}: removed generic admin feature internals are forbidden`);
    if (/features\/admin\/support-(?:conversation|workspace)(?:\.js)?["']/u.test(source))
        failures.push(`${relativeFile}: support workflows belong to features/support`);
    if (/features\/(?:governance\/governance-actions|free-ai\/free-ai-workspace)(?:\.js)?["']/u.test(source))
        failures.push(`${relativeFile}: access and Free AI workflows belong to features/user-governance`);
    if (sourceLayer === 'app' && /features\/admin-record\//u.test(source))
        failures.push(`${relativeFile}: app must compose admin record pages through widgets/admin-record-page`);
    if (
        !relativeFile.startsWith('entities/admin-record/') &&
        /\[\s*["']admin-(?:detail|related|filters)["']/u.test(source)
    )
        failures.push(`${relativeFile}: admin record query keys belong to entities/admin-record`);
    if (
        !relativeFile.startsWith('entities/support-ticket/') &&
        /\[\s*["']admin-support-(?:workspace|messages)["']/u.test(source)
    )
        failures.push(`${relativeFile}: support query keys belong to entities/support-ticket`);

    if (!relativeFile.startsWith('mocks/') && relativeFile !== 'shared/api/contracts.generated.ts') {
        const literalPatterns = [
            /queryKey\s*:\s*\[[^\]\r\n]*\]/gu,
            /(?:setQueryData|getQueryData|ensureQueryData)\s*\(\s*\[[^\]\r\n]*\]/gu,
            /(?:export\s+)?const\s+[A-Za-z0-9_]*(?:key|Key)[A-Za-z0-9_]*\s*=\s*\[[^\]\r\n]*\]/gu,
        ];
        for (const pattern of literalPatterns) {
            for (const match of source.matchAll(pattern)) {
                const fingerprint = match[0].replace(/\s+/gu, ' ').trim();
                const debtKey = `${relativeFile}|${fingerprint}`;
                observedLiteralQueries.set(debtKey, (observedLiteralQueries.get(debtKey) ?? 0) + 1);
            }
        }
    }

    const parsedImports = moduleSpecifiers(file, source);
    if (parsedImports.computedDynamicImport)
        failures.push(
            `${relativeFile}: computed dynamic imports are forbidden because the dependency cannot be proven`,
        );
    for (const specifier of parsedImports.specifiers) {
        if (!specifier.startsWith('.')) {
            if (!isDeclaredPackage(specifier))
                failures.push(`${relativeFile} -> ${specifier}: undeclared bare import or path alias is forbidden`);
            continue;
        }

        const unresolvedTarget = path.resolve(path.dirname(file), specifier);
        const targetFile = resolveRelativeImport(file, specifier, sourceFiles);
        const targetForBoundary = targetFile ?? unresolvedTarget;
        const targetLayer = layerOf(targetForBoundary);
        const targetSlice = sliceOf(targetForBoundary);
        const targetRelative = targetFile ? relative(targetFile) : relative(unresolvedTarget);
        const edgeKey = `${relativeFile}->${targetRelative}`;
        if (targetFile) graph.get(normalizedFile)?.add(path.normalize(targetFile));

        const ranks = { shared: 1, entities: 2, features: 3, widgets: 4, app: 5 };
        if (sourceLayer === 'mocks' && ['app', 'widgets', 'features'].includes(targetLayer))
            failures.push(`${edgeKey}: mocks may depend only on mocks, entities and shared`);
        if (sourceLayer !== 'mocks' && targetLayer !== 'mocks' && ranks[sourceLayer] < ranks[targetLayer])
            failures.push(`${edgeKey}: lower layers must not depend on upper layers`);
        if (
            sourceLayer === 'features' &&
            targetLayer === 'features' &&
            sourceSlice !== targetSlice &&
            !crossSliceDebt.has(edgeKey)
        )
            failures.push(`${edgeKey}: feature-to-feature imports are forbidden`);
        if (
            sourceLayer === 'entities' &&
            targetLayer === 'entities' &&
            sourceSlice !== targetSlice &&
            !crossSliceDebt.has(edgeKey)
        )
            failures.push(`${edgeKey}: entity-to-entity imports are forbidden`);

        if (targetLayer === 'mocks' && sourceLayer !== 'mocks') {
            const allowedAppComposition =
                sourceLayer === 'app' &&
                appMockCompositionRoots.has(relativeFile) &&
                source.includes('import.meta.env.DEV');
            if (!allowedAppComposition)
                failures.push(`${edgeKey}: mocks may only be loaded by an explicit development app composition root`);
        }

        if (
            targetSlice &&
            !['app', 'mocks'].includes(targetSlice) &&
            sourceSlice !== targetSlice &&
            !publicEntriesForSlice(targetSlice).includes(targetRelative) &&
            !privateImportDebt.has(edgeKey)
        )
            failures.push(`${edgeKey}: external consumers must use the ${targetSlice} public entrypoint`);
    }
}

for (const [slice] of slices) {
    const entries = publicEntriesForSlice(slice);
    if (!entries.some((entry) => sourceByRelative.has(entry)))
        failures.push(`${slice}: active slice requires an explicit public entrypoint (${entries.join(' or ')})`);
    for (const entry of entries) {
        const source = sourceByRelative.get(entry);
        if (!source) continue;
        const count = source.match(/^export\s+\*/gmu)?.length ?? 0;
        const allowed = exportStarDebt.get(entry) ?? 0;
        if (count > allowed)
            failures.push(
                `${entry}: public entrypoints must use explicit named exports (found ${count}, allowed debt ${allowed})`,
            );
    }
}

for (const [debtKey, count] of observedLiteralQueries) {
    const allowed = literalQueryDebt.get(debtKey) ?? 0;
    if (count > allowed)
        failures.push(
            `${debtKey}: literal private query/cache key is forbidden (found ${count}, allowed debt ${allowed})`,
        );
}

let tarjanIndex = 0;
const tarjanStack = [];
const tarjanState = new Map();
const cycleComponents = [];
function connect(node) {
    const state = { index: tarjanIndex, low: tarjanIndex, stacked: true };
    tarjanIndex += 1;
    tarjanState.set(node, state);
    tarjanStack.push(node);
    for (const target of graph.get(node) ?? []) {
        const targetState = tarjanState.get(target);
        if (!targetState) {
            connect(target);
            state.low = Math.min(state.low, tarjanState.get(target).low);
        } else if (targetState.stacked) {
            state.low = Math.min(state.low, targetState.index);
        }
    }
    if (state.low !== state.index) return;
    const component = [];
    let member;
    do {
        member = tarjanStack.pop();
        tarjanState.get(member).stacked = false;
        component.push(member);
    } while (member !== node);
    if (component.length > 1 || graph.get(node)?.has(node)) cycleComponents.push(component.map(relative).sort());
}
for (const file of graph.keys()) {
    if (!tarjanState.has(file)) connect(file);
}
for (const component of cycleComponents) {
    const fingerprint = component.join('|');
    if (!cycleDebt.has(fingerprint)) failures.push(`relative import cycle detected: ${component.join(' -> ')}`);
}

if (failures.length) {
    console.error(['Architecture boundary violations:', ...failures.map((item) => `- ${item}`)].join('\n'));
    process.exitCode = 1;
} else {
    console.log('Architecture boundaries are valid; public APIs, debt ratchets and import graph are clean.');
}
