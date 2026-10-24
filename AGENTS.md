# Meal Admin — правила проекта

Самостоятельная React/Vite админка. Все исходники здесь; backend и пользовательский frontend — отдельные репозитории. Не импортировать соседние исходники. `design-system` — локальная копия workspace; изменения синхронизировать отдельно и версионировать затронутые пакеты.

Сохранять API-клиент, OpenAPI snapshots, staff roles/grants, MFA и fail-closed операции. Критичное действие: permission check → re-auth/MFA → preview → confirm → execute → audit/readback. Не раскрывать internal notes, персональные данные или payload без grant. Покрывать loading, empty, stale, validation, forbidden, conflict, partial/unknown и provider failure.

Запуск и режимы описаны в README, проверки — TESTs.md. После изменений повышать patch-версию штатным npm version --no-git-tag-version, синхронизировать lock и version-list.md. Результаты QA, временные сборки и секреты не коммитить; QA_OUTPUT_DIR направлять в отдельную папку D:\AITemp. Проверки: npm ci, npm run check, npm run build; browser/E2E результаты разделять на mock и real. Контракты менять только по согласованному backend артефакту и проверять генератор.
