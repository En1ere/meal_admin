# Проверка Meal Admin

## Recovery-доступ к backup 0.0.136 — 03.11.2026

1. Backend и admin contract должны принимать отдельный tab code `backup_recovery`; неизвестный tab по-прежнему отклоняется strict schema.
2. Вкладка содержит одну карточку `local-backup-recovery-access`, чтобы не дублировать operational health из «Деплой и backup».
3. Карточка показывает только фиксированные пути password file/repository, права `root:root 0600`, root SSH-инструкцию, правила encrypted secure note и последовательность restic rotation.
4. Response, DOM, console и network не содержат password, его hash/fingerprint или кнопку reveal/copy-secret. `secret` содержит только configured boolean и `null` metadata.
5. Даже при configured key состояние остаётся partial с owner input `offline_recovery_copy_unconfirmed`: без отдельного critical attestation API нельзя утверждать, что независимая копия создана.
6. Проверить четыре темы, keyboard navigation и mobile viewport: восьмая вкладка доступна через горизонтальный tab scroll, карточка читается без горизонтального переполнения.

## Синхронизация backend media-контракта 0.0.131 — 02.11.2026

1. `contracts/openapi.json` и `contracts/http-cases.json` должны побайтно соответствовать backend `0.0.160`; `npm run contracts:check` проверяет OpenAPI `0.0.63` и 106 административных операций.
2. Generated admin client не должен экспортировать пользовательские `/api/v1/media/*`: эти маршруты требуют user-session и не являются staff/admin API.
3. Существующие auth/MFA, testing workspace, moderation и observability маршруты должны сохранить сигнатуры и defensive error envelopes.
4. `/admin/runtime-settings` получает только безопасные server projections: секреты не передаются, partial-source явно виден, Web Push меняется только через version-bound preview, critical confirmation, execute и readback.
5. Появление staff media moderation допускается только после отдельного backend endpoint/grant/audit контракта; ослаблять фильтр generator или обращаться к user endpoint из админки запрещено.
6. Schema v33 и media processor не означают включение пользовательских загрузок: до отдельного capacity/OOM drill UI не должен показывать фиктивно успешную media-операцию.

## Восстановление после stale lazy chunk 0.0.130 — 02.11.2026

1. Открыть админку, оставить вкладку на уже загруженной версии, развернуть новую immutable-сборку и перейти на ранее не открывавшийся lazy-маршрут, например `/admin/testing`.
2. При `vite:preloadError` приложение должно один раз перезагрузить тот же полный URL и открыть маршрут из актуальной сборки без ручного нажатия «Повторить».
3. Повторная ошибка chunk для той же версии и точного URL не должна запускать reload-loop: управление переходит существующему route error boundary.
4. Новый release или другой location получают независимый one-shot marker. Если `sessionStorage` недоступен, автоматический reload не выполняется, чтобы исключить бесконечный цикл.

Автоматические проверки: `test/preload-recovery.test.ts` проверяет `preventDefault`, ровно одну перезагрузку, изоляцию marker по версии/location и fail-closed поведение при недоступном хранилище.

## Auth/MFA onboarding и темы 0.0.129 — 02.11.2026

1. На `/auth` проверить точное назначение административной сессии, доступность переключателя всех четырёх тем и отсутствие принудительной тёмной browser color-scheme в светлых темах.
2. Первый парольный вход должен вернуть существующий backend enrollment `{ secret, uri }`. Экран показывает пошаговую ручную настройку, копирование секрета, безопасную `otpauth://totp/` ссылку и шестизначное numeric-поле; URI другого протокола ссылкой не становится.
3. После успешного TOTP десять одноразовых recovery-кодов можно скопировать одним действием, но продолжение остаётся заблокированным до явного подтверждения сохранения.
4. Повторный вход с уже настроенным фактором не показывает секрет и предлагает TOTP или recovery-код. Ошибка получает keyboard focus; clipboard failure не скрывает значение и предлагает ручное копирование.
5. Backend-контракт не содержит admin endpoint для сброса/перепривязки потерянного TOTP и не содержит создания service account. Если у существующего администратора нет приложения и recovery-кодов, frontend не может безопасно восстановить доступ: нужен отдельный согласованный backend flow с re-auth/audit, после чего UI и generated contract должны быть дополнены.

Автоматические проверки: `test/auth-enrollment.test.ts` проверяет allowlist `otpauth://totp/` и формат recovery-кодов; `design-system/test/theme-tokens.test.mjs` блокирует повторное принудительное `color-scheme: dark`; `e2e-admin/auth-onboarding.spec.ts` описывает browser flow без открытия внешнего authenticator handler. Полный browser-прогон в этой итерации не выполнялся: in-app browser недоступен текущей дочерней задаче, а прямой Playwright-запуск не разрешался Product Design audit workflow.

## Приёмочный чек-лист 0.0.125 — 29.10.2026

1. Войти администратором с MFA и открыть `/admin/testing` либо пункт «Система → Тестирование».
2. Убедиться, что каталог содержит четыре группы и показывает серверный прогресс; поиск, фильтр статуса и раскрытие групп не меняют результаты.
3. Открыть кейс, выбрать «Пройдено», «Частично» или «Не пройдено», добавить комментарий и сохранить. После reload статус, комментарий, автор и время должны сохраниться.
4. «Сохранить и далее» переходит к следующему видимому кейсу только после подтверждённого ответа backend. «Назад» выбирает предыдущий видимый кейс.
5. «Вернуть на проверку» переводит сохранённый результат в «Не проверено», сохраняя комментарий и серверную историю. Несохранённый черновик исходно непроверенного кейса отменяется локально.
6. При `409/412` актуальная версия перечитывается, локальный черновик не теряется. При network/5xx исход считается неизвестным; доступен только точный повтор замороженной команды с тем же idempotency key.
7. Проверить четыре темы, keyboard flow и viewport `390×844`: обе панели переходят в одну колонку, status controls и нижние действия доступны без горизонтальной прокрутки.

Автоматические проверки покрывают strict generated contract, session-scoped query keys, порядок/фильтры/прогресс, explicit reset и frozen save intent. Mock-режим хранит результаты между reload в общей mock repository; production-приёмка обязана подтвердить запись в PostgreSQL и audit/readback.

## Наблюдаемость 0.0.124 — 29.10.2026

1. Войти администратором с обязательным MFA и открыть `/admin/observability` либо пункт «Система → Наблюдаемость».
2. Убедиться, что экран показывает отдельные блоки «Хост и диски», «Сервисы», «База данных», «Очередь», «Воркеры» и «Провайдеры».
3. Для полного свежего снимка без ошибок верхний статус сообщает о штатной работе. При `partial`, `stale`, `unavailable`, ошибках контейнеров, очереди, воркеров или провайдеров появляется текстовый сигнал и безопасная ссылка в существующий диагностический раздел.
4. Нажать «Обновить снимок»: выполняется только чтение, кнопка временно блокируется, при ошибке обновления сохраняется предыдущий снимок с предупреждением.
5. Проверить `coffee-light`, `coffee-dark`, `nature-light`, `nature-dark`: цвета берутся из дизайн-системы, статус различим не только цветом.
6. На ширине `390×844` блоки становятся одноколоночными, горизонтального переполнения нет. На desktop структура соответствует выбранному варианту 1.
7. Проверить отсутствие кнопок перезапуска, повторного запуска задач, отмены и сырых логов: экран намеренно read-only.

Автоматические проверки: strict generated contract, session-scoped query key, null/zero semantics, informational worker states и fail-safe issue derivation покрыты unit/contract тестами. Desktop/mobile E2E находится в `e2e-admin/observability.spec.ts`.

## Container delivery 0.0.119 — 28.10.2026

- `npm run check`: PASS; design-system `5/5`, application unit `117/117`, contracts `102`, architecture/type/ESLint/Prettier/Stylelint PASS.
- `VITE_API_MODE=real VITE_APP_VERSION=0.0.119 npm run build`: PASS; Vite `8.2.4`, `282` modules, production artifact gate PASS. В artifact отсутствуют `mockServiceWorker.js`, source maps и env-файлы.
- `npm run test:performance:budget`: PASS; `15` chunks, max raw `375988`, max gzip `86725`, total raw `925309`, total gzip `202691` bytes.
- Playwright discovery: PASS, `134` теста в `17` файлах, desktop/mobile. Полный browser E2E повторно не запускался, поскольку runtime и тестовые сценарии не менялись.
- `.github/workflows/deploy.yml` разобран YAML parser; jobs quality-gate/image/deploy присутствуют. Реальный GitHub run, GHCR push, server helper и deploy не выполнялись.
- Docker image и Nginx runtime локально не собирались: Docker CLI/daemon в рабочей среде отсутствует. До merge требуется CI image build; до rollout — container `/healthz`, hard-fail `/api`, read-only filesystem и host gateway smoke.
- Base images зафиксированы проверенными registry references `node:24.22.1-alpine@sha256:06d7…18b53` и `nginxinc/nginx-unprivileged:1.28.0-alpine@sha256:c97f…657a0`; оба digest фактически получены из registry на Docker Engine 29.9.2 тестового VPS 28.10.2026. Workflow запрашивает BuildKit provenance и SBOM, но их публикация подтверждается только реальным GitHub run.
- Deploy workflow дважды сверяет проверенный source SHA с актуальным tip `main` и fail-closed отклоняет stale run; GHCR получает только уникальный commit tag, а rollout использует registry digest.

## Актуальный checkpoint 28.10.2026

Репозиторная версия `0.0.118`; развёрнутая SPA — `0.0.117`, design-system — `0.0.10`. Production admin работает с backend `0.0.128`, OpenAPI `0.0.60` и schema `v29`.

- `npm run check`: PASS; design-system `5/5`, application unit `117/117`, contracts `102` operations, architecture/type/ESLint/Prettier/Stylelint PASS.
- `npm run build`: PASS; Vite `8.2.4`, `282` modules.
- Playwright discovery: `134` теста в `17` файлах.
- Полный mock E2E в system Edge: PASS `134/134` за `10.7m`, desktop `67/67`, mobile `67/67`, `workers=1`, `retries=0`.
- Production smoke admin `0.0.117`: root и `/admin/queues/recipes` — `200`; парольный вход доходит до обязательной MFA-границы; `coffee-light` и `nature-dark` переключаются без runtime errors; liveness/readiness — `200`.

Этот E2E-прогон использует development mocks и не заменяет полную live-приёмку мутаций. Для сквозной модерации нужен действующий второй фактор тестового администра. Внешние payment/email/push/AI/storage/scanner providers остаются fail-closed.

## Исторический перенос 24.10.2026

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

## Reliability checkpoint 03.11.2026

- Полный `npm run check`: design-system 7/7, contracts OpenAPI 0.0.65 / 109 операций, architecture/type/lint/style/format PASS, unit 136/136.
- Production build/browser budget PASS: 21 chunk, max raw/gzip 398,129/88,287 B, total raw/gzip 1,008,420/224,641 B; dependency audit — 0 vulnerabilities.
- Edge desktop/mobile reliability pack 28/28 PASS; отдельный moderation residual pack 10/10 PASS без retry/flaky.
- VPS PostgreSQL/application restart и frontend immutable rollback/roll-forward завершены all-component verify; после global backend limiter окна admin `/auth` вернул 200.
- Physical screen reader/device, реальные payment/SMTP/AI/scanner providers и production RUM остаются внешними release gates.
