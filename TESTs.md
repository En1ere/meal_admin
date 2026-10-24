# Проверка Meal Admin

## Перенос 24.10.2026

Админка выделена из meal_frontend/frontend_admin в самостоятельный meal_admin. Версии: app 0.0.96, design-system 0.0.10. Сценарии и API сохранены; копия дизайн-системы живёт здесь, установка не требует соседних репозиториев.

Исправление SPLIT-QA-01: после MFA API-клиент инвалидировался, а principal помещался в query cache напрямую, поэтому `authenticated` оставался false до следующего успешного auth/me. При expiry первая 401 от auth/me/status считалась анонимным bootstrap, несмотря на существующий proof. Теперь доказательство предыдущего входа также запускает однократную очистку private context. Анонимный bootstrap без proof и неверный MFA остаются прежними. Regression покрывает удаление proof/storage и однократное оповещение до первой успешной auth/me.

Команды запуска всех трёх приложений и real/mock режимы — README. PostgreSQL на тестовом VPS проверяется совместно с backend; unit/mocks не доказывают подключение к реальной БД. Полный бизнес E2E и реальные внешние провайдеры требуют отдельной приёмки.

Независимые проверки на Node 24.22.1/npm 11.12.1:

- Чистая `npm ci`: PASS.
- `npm run check`: PASS, 91 тест приложения и 5 дизайн-системы, 102 операции контрактов, типы, линт, форматирование и стили.
- Production `npm run build`: PASS.
- Playwright discovery: 100 тестов в 10 файлах. Полный набор не запускался.
- Vite обновлён минимальным patch 8.2.2→8.2.4; `npm audit` и `npm audit --omit=dev`: 0 уязвимостей. Check/build повторены после patch.

Существующий `scripts/admin-browser-smoke.mjs` полностью PASS в Edge desktop 1440×1000/mobile 390×844: auth/MFA/reload/newtab, 18 разделов, каталоги, billing fail-closed, news, notifications, logout/recovery, семидневное истечение и недоступное IndexedDB. Исходный SPLIT-QA-01 больше не воспроизводится; pageerror отсутствуют. Это mock smoke, не real business acceptance. Desktop home и mobile users просмотрены визуально: обрезаний и наложений не обнаружено.

Локальный production preview (`npm start` / `npm run preview`) проксирует `/api` к loopback `BACKEND_ORIGIN` в real-режиме, с теми же headers/localhost/strictPort. Static hosting по-прежнему требует отдельного reverse proxy. После этой настройки повторены config lint, TypeScript и production build; совместная проверка собранных интерфейсов с реальным backend фиксируется отдельно.

## Совместная real-проверка

Собранный admin preview, production Next frontend и API на 3001 с основной PostgreSQL проверены совместно: database readiness, CSRF/cookie, анонимный me→401 и HTML доступны. В четырёх браузерных контекстах (оба интерфейса desktop/mobile) проверены отсутствие development mocks, pageerror и горизонтального переполнения.

На отдельном API 3003 с временным изолированным PostgreSQL и синтетическими fixtures выполнены реальные браузерные auth-сценарии: пользователь login→me200→logout→me401; администратор password+TOTP→me/status200 unlocked→logout с очищенным tab proof. Pageerror не возникли. Это проверка подключения и авторизации; полный E2E-набор, полная визуальная бизнес-приёмка и реальные внешние провайдеры не проверялись. Тестовые fixtures создавались в отдельном временном кластере, а не в основной БД сервиса.
