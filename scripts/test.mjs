import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { qaRoot } from './qa-output.mjs';
const directory = join(fileURLToPath(qaRoot()), 'test-build', 'test');
const files = readdirSync(directory)
    .filter((file) => file.endsWith('.test.js'))
    .map((file) => join(directory, file));
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
