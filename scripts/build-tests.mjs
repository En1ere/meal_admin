import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { join } from 'node:path';
import { qaRoot } from './qa-output.mjs';
const output = join(fileURLToPath(qaRoot()), 'test-build');
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'package.json'), JSON.stringify({ type: 'module' }));
if (!existsSync(join(output, 'node_modules')))
    symlinkSync(
        resolve('node_modules'),
        join(output, 'node_modules'),
        process.platform === 'win32' ? 'junction' : 'dir',
    );
const result = spawnSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.test.json', '--incremental', 'false', '--outDir', output],
    { stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
