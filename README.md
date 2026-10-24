# Meal Admin

Самостоятельная административная React/Vite SPA Meal Planner. Версия: 0.0.96. Исходники и зависимости полностью находятся в этом репозитории; `design-system` — локальная копия npm workspace (0.0.10), без ссылок на соседние проекты.

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

Production build всегда real; mock в build/preview запрещён. `npm run preview` и `npm start` показывают локальную папку `build` на localhost:3002 и проксируют `/api` к валидированному loopback `BACKEND_ORIGIN`, поэтому собранная админка работает с локальным backend без дополнительного веб-сервера. Это localhost preview для проверки сборки; при публикации нужен отдельный reverse proxy, направляющий `/api` к backend. При `QA_OUTPUT_DIR` для preview передайте `--outDir <QA_OUTPUT_DIR>/build`. При будущем static hosting настроить SPA fallback на index.html, `/api` reverse proxy и защитные заголовки из `vite.config.ts`; не публиковать Vite dev server. Отсутствие постоянного домена не мешает локальной разработке. Frontend/backend приложения на VPS этой задачей не развёртываются.

## Контракты и доступ

Backend владеет roles/grants, staff auth/MFA и критичными операциями. Скрытая кнопка не заменяет серверную проверку. Снимки OpenAPI/HTTP cases в `contracts` переносимы; `node scripts/check-backend-contract.mjs <backend-openapi-path>` проверяет согласованность без импорта backend-кода. Изменения API требуют отдельного согласования.

Критичные действия сохраняют permission → re-auth/MFA → preview → confirm → execute → audit/readback. Внешние провайдеры работают fail-closed. Полезные сценарии и результаты переноса записаны в `TESTs.md`.
