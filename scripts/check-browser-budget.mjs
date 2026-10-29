import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = process.env.QA_OUTPUT_DIR;
const assets = output ? path.join(output, 'build', 'assets') : path.join(root, 'build', 'assets');
const budgets = {
    chunks: 20,
    maxRawBytes: 500_000,
    maxGzipBytes: 100_000,
    totalRawBytes: 1_100_000,
    totalGzipBytes: 240_000,
};
const forbidden = [
    /ACCEPTANCE_OWNER_DATABASE_URL/u,
    /\bDATABASE_URL\b/u,
    /\bmeal_owner\b/u,
    /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/u,
    /application-grants\.sql/u,
];

const chunks = [];
for (const entry of await readdir(assets, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const bytes = await readFile(path.join(assets, entry.name));
    const source = bytes.toString('utf8');
    assert.equal(
        forbidden.some((pattern) => pattern.test(source)),
        false,
        `${entry.name}: server-only marker leaked into a browser chunk`,
    );
    chunks.push({ rawBytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 9 }).length });
}
assert.ok(chunks.length > 0, 'production JavaScript chunks are missing; run the build first');
const metrics = {
    chunks: chunks.length,
    maxRawBytes: Math.max(...chunks.map((chunk) => chunk.rawBytes)),
    maxGzipBytes: Math.max(...chunks.map((chunk) => chunk.gzipBytes)),
    totalRawBytes: chunks.reduce((sum, chunk) => sum + chunk.rawBytes, 0),
    totalGzipBytes: chunks.reduce((sum, chunk) => sum + chunk.gzipBytes, 0),
};
for (const [name, budget] of Object.entries(budgets))
    assert.ok(metrics[name] <= budget, `${name} ${metrics[name]} exceeds budget ${budget}`);
console.log(`Admin browser budget passed: ${JSON.stringify(metrics)}`);
