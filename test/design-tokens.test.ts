import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import test from 'node:test';

await test('application styles use design-system colors instead of local literals', () => {
    const violations = globSync('src/**/*.css').flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        return [...source.matchAll(/#[\da-f]{3,8}\b|rgba?\([^)]*\)/giu)].map((match) => `${file}: ${match[0]}`);
    });
    assert.deepEqual(violations, []);
});
