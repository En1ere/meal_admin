import { readdir, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

const output = process.env.QA_OUTPUT_DIR ? resolve(process.env.QA_OUTPUT_DIR, 'build') : resolve('build');
const required = ['index.html', 'theme-init.js'];
const forbiddenNames = new Set(['mockServiceWorker.js']);
const forbiddenSuffixes = ['.map', '.env', '.env.local', '.env.production'];

for (const file of required) {
    const info = await stat(resolve(output, file)).catch(() => undefined);
    if (!info?.isFile()) throw new Error(`Production artifact is missing ${file}`);
}

const assets = await stat(resolve(output, 'assets')).catch(() => undefined);
if (!assets?.isDirectory()) throw new Error('Production artifact is missing assets/');

async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) {
            await inspect(path);
            continue;
        }
        const name = relative(output, path).replaceAll('\\', '/');
        if (forbiddenNames.has(entry.name) || forbiddenSuffixes.some((suffix) => entry.name.endsWith(suffix))) {
            throw new Error(`Forbidden production artifact file: ${name}`);
        }
    }
}

await inspect(output);
console.log(`Production artifact gate passed: ${output}`);
