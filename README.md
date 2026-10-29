# Meal Admin

Самостоятельная административная React/Vite SPA Meal Planner. Версия: 0.0.127. Исходники и зависимости полностью находятся в этом репозитории; `design-system` — локальная копия npm workspace (0.0.10), без ссылок на соседние проекты. Архитектурные границы и поэтапная миграция описаны в `ARCHITECTURE.md`.

## Установка и запуск

Нужны Node.js 24.19+ (ветка 24) и npm 11. В корне выполнить `npm ci`, затем `npm run dev`. Админка доступна на `http://localhost:3002`. По умолчанию код dev использует development mocks и изолированное тестовое хранилище. В подготовленном локальном checkout ignored `.env.local` включает real API; этот файл не хранится в Git. Для mock smoke явно установите `$env:VITE_API_MODE='mock'` перед `npm run dev`. Не вводите реальные данные в mock-режиме.

Для работы с реальным API в PowerShell:

```powershell
$env:VITE_API_MODE='real'
$env:BACKEND_ORIGIN='http://127.0.0.1:3001'
npm run dev
```

`/api` проксируется к loopback backend. Для совместной разработки в отдельных терминалах: `meal_backend` → `npm run build`, затем `npm run start` (предварительно настроить его `.env` и подключение PostgreSQL по README backend), `meal_frontend` → `npm run dev`, `meal_admin` → команды real-режима выше. Клиент работает на 3000, backend на 3001, админка на 3002. Запуск любого frontend в mock-режиме не требует API или БД.

## Проверки

```powershell
$env:QA_OUTPUT_DIR='D:\AITemp\meal-admin-check'
npm run check
npm run build
npm run test:e2e:admin -- --list
```

`check` включает design-system typecheck/tests, проверку контрактов, TypeScript, ESLint, Prettier, Stylelint и тесты админки. `QA_OUTPUT_DIR` обязателен для unit/browser/E2E результатов; с ним production build тоже сохраняется туда. Для CI задаётся отдельный временный каталог. `npm run test:browser` проверяет уже запущенный mock dev server; `npm run test:e2e:admin` запускает свой сервер, порт 3002 должен быть свободен. Chromium: `npx playwright install chromium`; установленный браузер можно указать `PLAYWRIGHT_EXECUTABLE_PATH` для smoke.

Production build всегда real; mock в build/preview запрещён. `npm run preview` и `npm start` показывают локальную папку `build` на localhost:3002 и проксируют `/api` к валидированному loopback `BACKEND_ORIGIN`, поэтому собранная админка работает с локальным backend без дополнительного веб-сервера. Это localhost preview для проверки сборки; при публикации нужен отдельный reverse proxy, направляющий `/api` к backend. При `QA_OUTPUT_DIR` для preview передайте `--outDir <QA_OUTPUT_DIR>/build`.

Production image собирается через `Dockerfile`: multi-stage build создаёт только real SPA, проверяет browser budget и production artifact gate, затем unprivileged Nginx выдаёт статику на внутреннем порту `8080`. `/healthz` проверяет выдачу контейнера, `/api` внутри контейнера намеренно отвечает `404`: same-origin `/api` обязан маршрутизировать внешний host Nginx напрямую в backend. Контейнер не публикует порт самостоятельно и рассчитан на read-only filesystem с writable tmpfs `/tmp`. Development `mockServiceWorker.js`, source maps и env-файлы в production artifact не допускаются.

Тестовый production-стенд развёрнут на `https://admin.abstract-usable-gazebo.ruweb.place`: host Nginx проксирует SPA в hardened Docker-контейнер на loopback `127.0.0.1:3002`, а same-origin `/api` — в backend `3001`. Собственный release/rollback runbook находится в `DEPLOYMENT.md`; общие службы, PostgreSQL, backup, TLS и сеть описаны в `meal_backend/docs/DEPLOYMENT.md`. Планируемый `https://admin.meal.royalexander.online` остаётся pending DNS и не является текущим production origin до выпуска сертификата и отдельного cutover-smoke. Пароль и MFA-секреты в Git не хранятся. Подробная ручная приёмка админки находится в `ADMIN_TESTING.md`.

## Контракты и доступ

Backend владеет roles/grants, staff auth/MFA и критичными операциями. Скрытая кнопка не заменяет серверную проверку. Снимки OpenAPI/HTTP cases в `contracts` переносимы; `node scripts/check-backend-contract.mjs <backend-openapi-path>` проверяет согласованность без импорта backend-кода. Изменения API требуют отдельного согласования.

Текущий контракт синхронизирован с backend `0.0.151`: OpenAPI `0.0.61`, database schema `v31`. Wire paths и payload не менялись; additive schema добавляет только внутреннюю транзакционную account-mail очередь. В recipe moderation обязательные серверные оси `review` и `publication` разделяют проверяемую редакцию и активную публикацию; полностью legacy-ответ без обеих осей всё ещё нормализуется, а частичный schema drift отклоняется generated-схемой. Развёрнутая admin дополнительно предоставляет `/admin/testing` с server-side каталогом из 83 приёмочных кейсов. Полный registry digest хранится в защищённом server inventory и намеренно не дублируется сокращённым или вымышленным значением в README.

Критичные действия сохраняют permission → re-auth/MFA → preview → confirm → execute → audit/readback. Внешние провайдеры работают fail-closed. Полезные сценарии и результаты переноса записаны в `TESTs.md`.

Модерация и каталог используют единый bounded context `content-workflow`: приватный cache изолирован staff-сессией, а после неизвестного исхода mutation интерфейс сохраняет полный исходный command и предлагает отдельный точный повтор. Пока исход неизвестен, автоматическое обновление, новый compare и изменённое решение блокируются; `409/412` сначала перечитывает workspace и generic admin-record. Любое решение модерации требует свежего critical confirmation; при его истечении оператор подтверждает действие и отправляет тот же command/key. При активном confirmation обычный `403` объясняется как запрет роли/доступа, а не как запрос нового TOTP. Protected `401` может размонтировать приватный экран: после auth recovery оператор обязан перечитать состояние и проверить исход команды.
