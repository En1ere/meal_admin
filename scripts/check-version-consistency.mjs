import { readFile } from 'node:fs/promises';

const [manifestText, lockText, versionList] = await Promise.all([
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../package-lock.json', import.meta.url), 'utf8'),
    readFile(new URL('../version-list.md', import.meta.url), 'utf8'),
]);

const manifest = JSON.parse(manifestText);
const lock = JSON.parse(lockText);
const versions = {
    manifest: manifest.version,
    lockfile: lock.version,
    lockfileRoot: lock.packages?.['']?.version,
    versionList: versionList.match(/^\d+\.\d+\.\d+(?=\s+-)/m)?.[0],
};

const expected = versions.manifest;
const mismatches = Object.entries(versions).filter(([, version]) => version !== expected);

if (mismatches.length > 0) {
    const details = Object.entries(versions)
        .map(([source, version]) => `${source}=${version ?? '<missing>'}`)
        .join(', ');
    throw new Error(`Version consistency check failed: ${details}`);
}

console.log(`Version consistency check passed: ${expected}`);
