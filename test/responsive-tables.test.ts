import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const cases = [
    {
        source: 'src/features/content/content-workspace.tsx',
        css: 'src/features/content/content-workspace.module.css',
        labels: ['Поле', 'Текущая карточка', 'Кандидат', 'Итог'],
    },
    {
        source: 'src/features/review/review-workspace.tsx',
        css: 'src/features/review/review-workspace.module.css',
        labels: ['Объект', 'До / после исходного действия', 'Сейчас', 'Результат проверки'],
    },
    {
        source: 'src/features/user-governance/free-ai-workspace.tsx',
        css: 'src/features/user-governance/free-ai-workspace.module.css',
        labels: ['Источник', 'Выдано', 'Доступно', 'Резерв', 'Срок'],
    },
] as const;

for (const item of cases) {
    void test(`${item.source} exposes a labelled mobile card table`, () => {
        const source = readFileSync(item.source, 'utf8');
        const css = readFileSync(item.css, 'utf8');

        for (const label of item.labels) assert.match(source, new RegExp(`data-label=["']${label}["']`, 'u'));
        assert.match(css, /@media \(width <= 800px\)/u);
        assert.match(css, /content:\s*attr\(data-label\)/u);
        assert.match(css, /overflow:\s*visible/u);
    });
}
