# Версии meal_admin

0.0.165 - 11.07.2026 | 03:03 - Admin синхронизирован с backend OpenAPI 0.0.72/schema v38: observability распознаёт отдельный `ai-content-retention` worker и показывает его lease, freshness, outcome, duration и failures под понятным названием «Очистка AI-контента». Моки и generated contracts обновлены до 11 worker-задач; raw AI payloads и персональные данные в проекцию не добавлялись.

0.0.164 - 11.07.2026 | 02:08 - AI control plane синхронизирован с backend OpenAPI 0.0.71/schema v3. Экран показывает выбранные model/pricing profile, месячный USD-лимит, actual cost, conservative held cost для pending/unknown, остаток, utilization и состояния stop-loss `unconfigured/disabled/ready/exhausted`. Неготовый или исчерпанный контур объясняет блокировку и следующий шаг; API остаётся read-only и не раскрывает ключ, endpoint credentials, prompt, context, result или provider request ID.

0.0.163 - 11.07.2026 | 00:05 - OpenAPI синхронизирован до 0.0.70 после добавления canonical async continuation; read-only AI control plane schema v2 показывает общие lifecycle/financial агрегаты initial и continuation, возраст очереди и выполнения, unknown outcomes и `reconciliation_hold`. Экран объясняет оператору, что blind массовый refund запрещён, не раскрывает prompts, результаты, provider metadata или секреты. Генератор контрактов поддерживает документированные `202 Accepted` ответы.

0.0.162 - 11.06.2026 | 23:12 - Канонический backend OpenAPI синхронизирован до 0.0.68 после добавления пользовательского owner-scoped AI operation readback. Маршрут не входит в admin runtime allowlist, поэтому поведение и экран AI control plane не изменились; contract metadata/hash актуализированы.

0.0.161 - 11.06.2026 | 22:45 - Добавлена read-only страница `/admin/ai` по OpenAPI 0.0.67: readiness провайдера и обеих политик, агрегаты 24h/30d, статусы и таблица всех 18 задач с ценой, тарифами и обязательным/опциональным контекстом. Экран использует session-scoped query, ручное обновление, loading/error/empty states, адаптивную таблицу и только токены дизайн-системы; мутаций, prompts, персональных данных и секретов нет.

0.0.160 - 11.06.2026 | 22:20 - Синхронизирован канонический backend OpenAPI 0.0.66 после schema v36 AI context policy. Generated admin contracts поддерживают inventory/preferences/nutrition source manifest; UI и маршруты не менялись. Это типизированная база для отдельного read-only AI control room.

0.0.159 - 11.06.2026 | 22:05 - Синхронизирован канонический backend OpenAPI 0.0.65 после schema v35 AI task-entitlement policy. Generated admin contracts обновлены штатным генератором; маршруты, DTO и runtime-поведение не менялись, изменился только contract hash/metadata. Read-only AI control room остаётся следующим отдельным срезом после backend control-plane контракта.

0.0.158 - 11.05.2026 | 11:23 - Architecture Checkpoint 5E перенёс exact admin status query capability и critical confirmation component в специализированные public entrypoints `shared/auth`. Все 11 feature consumers и auth screens используют downward-safe owners напрямую; `features/auth/access-client.ts` оставлен named compatibility re-export с прежней runtime identity и нулём production consumers. Component-owned CSS сохраняет прежние form/alternate стили, UnlockScreen сохраняет свой minimal alternate style. Status/refetch, TOTP/recovery, cancellation, 401 reset+broadcast, expiry clock, DOM/text, API и wire semantics не изменены. CrossSlice debt уменьшен с 11 до 0; все architecture debt ratchets пусты.

0.0.157 - 11.05.2026 | 11:16 - Architecture Checkpoint 5D2 вывел публичный `AdminRecordSection` из generated generic admin search contract и удалил последние две entity-to-`admin-section` зависимости из query-key и presentation моделей. Feature composition типобезопасно преобразует navigation `Section`, отклоняя только отдельный release workspace через прежнее состояние «Раздел не найден»; query tuples, presentation, 28 routes, URL, API и runtime не изменены. Compile-time parity доказывает равенство generated params/success и `Section = AdminRecordSection | 'releases'`. CrossSlice debt уменьшен с 13 до 11; остались только согласованные feature-to-auth edges.

0.0.156 - 11.05.2026 | 11:09 - Architecture Checkpoint 5D1 удалил type-only lateral dependencies `billing-account` и `user-access` от navigation entity `admin-section`. Публичные `BillingSection` и `GovernanceSection` теперь являются точными локальными endpoint unions; двусторонние compile-time checks подтверждают равенство generated GET route params. Query tuples, runtime и существующие имена public API сохранены. CrossSlice debt уменьшен с 15 до 13; admin-record и auth edges не изменены.

0.0.155 - 11.05.2026 | 10:08 - Architecture Checkpoint 5C3 заменил последний wildcard re-export в `entities/content-release/index.ts` исчерпывающими named value/type exports. Полные contracts, model helpers и `contentReleaseKeys` сохраняют прежнюю module identity, все 13 публичных типов импортируются через index; parity tests блокируют пропуск любого runtime/type имени и возврат `export *`. Export-star debt уменьшен с 1 до 0, общий ratcheted debt — с 16 до 15; остался только явно учтённый crossSlice debt. Feature barrels, потребители, runtime, routes, UI, API и wire-контракты не изменены.

0.0.154 - 11.05.2026 | 10:03 - Architecture Checkpoint 5C2 заменил оба wildcard re-export в `entities/content-workflow/index.ts` исчерпывающими named value/type exports. Все прежние schema/helper/query-key values сохраняют module identity, полный command/result/domain type API сохранён; parity tests блокируют пропуск runtime/type имени и возврат `export *`. Export-star debt уменьшен с 3 до 1, общий ratcheted debt — с 18 до 16. Feature compatibility barrel, потребители, runtime, routes, UI, API и wire-контракты не изменены.

0.0.153 - 11.05.2026 | 09:58 - Architecture Checkpoint 5C1 заменил wildcard re-export в `entities/operation/index.ts` и `entities/news/index.ts` исчерпывающими named value/type exports. Все прежние runtime schemas, inferred public types и query-key exports сохранены с той же module identity; parity tests блокируют пропуск имени и возврат `export *`. Export-star debt уменьшен с 5 до 3, общий ratcheted debt — с 20 до 18. Runtime, routes, lazy boundaries, UI, API и wire-контракты не изменены.

0.0.152 - 11.05.2026 | 09:52 - Architecture Checkpoint 5B устранил оба разрешённых mock import cycle: `AdminRow` schema/type вынесены в нейтральный `mocks/admin-row.ts` с сохранением compatibility exports `admin-model`, а allergen handler теперь принимает только структурное состояние `{ allergens: AllergensState }` вместо всего `MockState`. Mock shapes, mutations и runtime-поведение сохранены; cycle SCC debt уменьшен с 2 до 0, общий ratcheted debt — с 22 до 20. Production source, UI, API и wire-контракты не изменены.

0.0.151 - 11.05.2026 | 09:45 - Architecture Checkpoint 5A объявил `preferences.ts` и `center-contracts.ts` специализированными публичными entrypoint сущности admin-notification, перевёл страницы и тест центра уведомлений с feature compatibility barrels и удалил эти zero-consumer barrels. Два wildcard re-export основного entity index заменены исчерпывающими named value/type exports с сохранением прежнего index API. Notification private-import debt уменьшен с 2 до 0, export-star debt — с 7 до 5; UI, runtime, cache, API и wire-контракты не изменены.

0.0.150 - 11.04.2026 | 18:17 - Architecture Checkpoint 4H свёл последние exact auth/session cache identities в специализированный downward-safe public entrypoint `shared/auth/query-keys.ts`. `staffSessionKeys` и `adminAuthStatusKey` сохранены совместимыми aliases; current session, session list и admin status используют прежние tuples без principal ID. Clear-before-set, enabled/query/invalidation, broadcast/rejection/reset и MFA/enrollment/unlock/reentry semantics не изменены. Literal query debt уменьшен с 6 до 0; отдельные feature-to-auth UI/hook edges не затрагивались.

0.0.149 - 11.04.2026 | 18:12 - Architecture Checkpoint 4G перенёс exact session-global allergen list/detail/subject query keys, successful detail cache write и broad list invalidation в private `allergenKeys` factory `features/allergens`. Прежние tuples без principal scope, enabled conditions, fetch/mutation/error/cache и UI semantics сохранены. Literal query debt уменьшен с 11 до 6 без нового entity или public API; runtime, auth и wire-контракты не изменены.

0.0.148 - 11.04.2026 | 18:07 - Architecture Checkpoint 4F перенёс exact principal-scoped recipe-policy query key в private `recipePolicyKeys` factory `features/settings`. Session principal source, disabled tuple с `undefined`, enabled gating, save flow и explicit `query.refetch()` не изменены. Literal query debt уменьшен с 12 до 11 без нового entity или public API; UI, runtime, API и wire-контракты не изменены.

0.0.147 - 11.04.2026 | 18:02 - Architecture Checkpoint 4E перенёс exact principal-scoped registry key и broad successful-execute invalidation runtime settings в private `runtimeSettingsKeys` factory одноимённого feature. Создание disabled tuple с `undefined` principal, session source, enabled gating, fetch/preview/execute/recovery и cache semantics не изменены. Literal query debt уменьшен с 14 до 12 без нового entity или public API; UI, runtime и wire-контракты не изменены.

0.0.146 - 11.04.2026 | 12:33 - Architecture Checkpoint 4D перенёс единый session-global exact workspace query key релизов в публичную `contentReleaseKeys` фабрику `entities/content-release`. Query и пять command-result cache writes используют прежний tuple и `ReleaseWorkspace`; enabled, fetch/command/refetch semantics и очистка cache при смене admin-session не изменены. Literal query debt уменьшен с 15 до 14 без ослабления architecture rule; UI, runtime, API и wire-контракты не изменены.

0.0.145 - 11.04.2026 | 12:26 - Architecture Checkpoint 4C перенёс единый exact workspace query key новостей в публичную `newsKeys` фабрику `entities/news`. List query и command-result `setQueryData` используют один tuple; save/preview/launch/cancel/test, errors и API behavior не изменены. Literal query debt уменьшен с 17 до 15 без ослабления architecture rule; UI, runtime и wire-контракты не изменены.

0.0.144 - 11.04.2026 | 12:20 - Architecture Checkpoint 4B перенёс exact principal-scoped workspace key и broad successful-execute invalidation операций в публичную `operationKeys` фабрику `entities/operation`. Inspect/preview/execute, unknown-outcome recovery, `enabled`, principal source и `adminRecord` invalidation не изменены; literal query debt уменьшен с 19 до 17 без ослабления architecture rule. UI, runtime, API и wire-контракты не изменены.

0.0.143 - 11.04.2026 | 05:08 - Architecture Checkpoint 4A перенёс principal-scoped query keys настроек и центра уведомлений в публичные tree-shakeable entrypoints `entities/admin-notification`. Точные cache tuples, admin-session gating, fetch/refetch и `setQueryData` semantics сохранены; literal query debt уменьшен с 21 до 19 без ослабления общего architecture rule. Раздельные entrypoints сохранили 21 browser chunk и не загружают center schemas на странице preferences. UI, runtime, API и wire-контракты не изменены.

0.0.142 - 11.04.2026 | 04:56 - Architecture Checkpoint 3A добавил типизированный app route metadata manifest для всех 28 JSX route nodes и перевёл title/admin-section interpretation на единый resolver. AST parity tests фиксируют count/order/path/binding, redirect, mock-only, lazy/access metadata, прежние title edge cases, focus/scroll и совместимость с `sectionPath`/`detailPath`/`activeSectionForPath`. JSX Route tree, lazy imports/loaders, URL, UI, runtime, API и wire-контракты не изменены.

0.0.141 - 11.04.2026 | 04:45 - Architecture Checkpoint 2 заменил точечный import gate на TypeScript-AST graph с общими layer/slice/public-API rules, cycle detection, fail-closed alias/computed-import policy и точными debt ratchets для текущих cross-slice edges, export-star, mock cycles, private imports и literal query keys. Focused fixtures доказывают каждый класс нарушений; ADR фиксирует исключения и пределы анализа. Production UI, routes, runtime, API и wire-контракты не изменены.

0.0.140 - 11.04.2026 | 04:33 - Architecture Checkpoint 1B удалил три внутренних compatibility barrel для news, operations и releases после перевода всех потребителей на entity public API. Architecture gate блокирует возврат barrels и удалённых legacy feature slices; пустые untracked директории не затрагивались. UI, routes, runtime, API и wire-контракты не изменены.

0.0.139 - 11.04.2026 | 04:27 - Architecture Checkpoint 1A добавил явные named public API для `admin-section`, `admin-shell` и `session-guard`, перевёл внешних потребителей с private module imports и закрепил границы architecture gate. URL, runtime, UI, API и контракты не изменены.

0.0.138 - 11.03.2026 | 15:21 - Checkpoint 0 устранил дрейф patch-версии без изменения runtime/API: `package.json` остаётся единственным источником, README больше не дублирует часто меняющийся номер, а `npm run version:check` блокирует расхождение manifest, lockfile и журнала версий.

0.0.137 - 11.03.2026 | 14:21 - Зафиксирован финальный reliability checkpoint без изменения admin runtime/API: полный check 136/136, build/browser budget и audit 0; Edge desktop/mobile основной pack 28/28 и recipe moderation residual 10/10 подтвердили auth/MFA, четыре темы, observability/runtime settings/recovery, approve/hide/unpublish, 409/503 и unknown-outcome readback. VPS restart и frontend immutable rollback/roll-forward завершились полным deployment verify; внешние providers и physical-device accessibility остаются отдельными gates.

0.0.136 - 11.03.2026 | 12:50 - В реестр конфигурации добавлена отдельная вкладка `Recovery-доступ` с одной смысловой карточкой: фиксированные пути restic password/repository, root-only получение, encrypted secure note, запрет plaintext/Git/.env/email/chat и безопасная последовательность ротации. Secret value/hash и reveal/copy-secret действие отсутствуют; состояние остаётся partial, пока независимая копия владельца не подтверждается отдельным механизмом. Контракт синхронизирован с backend 0.0.170 / OpenAPI 0.0.65 / schema v34.

0.0.135 - 11.02.2026 | 19:39 - Production browser budget baseline обновлён с 20 до 21 JavaScript chunk для новой независимо загружаемой страницы runtime settings. Лимиты максимального и суммарного raw/gzip-размера, проверка server-only маркеров и artifact gate не ослаблены; исправлен обнаруженный CI image-build regression.

0.0.134 - 11.02.2026 | 18:25 - Добавлен безопасный реестр конфигурации `/admin/runtime-settings` по выбранному варианту 2: семь вкладок, таблица состояния и боковая карточка с источником, готовностью, затронутыми сервисами, проверками, блокерами, инструкцией и историей. Секреты никогда не показываются значением — только presence/fingerprint/rotation. Web Push policy изменяется только через version-bound backend preview, свежее critical confirmation, execute и readback; env/VPS/GitHub-параметры остаются read-only. Добавлены partial/error/empty/stale-safe состояния, адаптивная таблица, четыре темы через semantic tokens, contract/UI regression tests и ручные тест-кейсы.

0.0.133 - 11.02.2026 | 17:36 - Deployment runbook синхронизирован с исправленным server gate: параллельные backend/frontend/admin rollout теперь ограниченно ожидают общий lock вместо ложного немедленного падения. Повторный immutable admin rollout используется как сквозная проверка исправления; UI, OpenAPI и публичные контракты не изменены.

0.0.132 - 11.02.2026 | 16:55 - OpenAPI snapshot и generated admin client синхронизированы с backend 0.0.162 / OpenAPI 0.0.63 после добавления isolated OCR preview contract. Новая admin-страница не требуется: sidecar и его ошибки остаются в существующей operations/observability модели; admin runtime, routes и permissions не изменены.

0.0.130 - 02.11.2026 | 11:23 - Добавлено one-shot восстановление после stale Vite lazy chunk при immutable-деплое: `vite:preloadError` перехватывается до React render, точный URL перезагружается один раз, а sessionStorage marker изолирован по версии и location и исключает reload-loop. При недоступном tab storage поведение остаётся fail-closed через существующий route error boundary. Добавлены regression-тесты и ручной cross-release сценарий; API и контракты не изменены.

0.0.129 - 02.11.2026 | 09:18 - Auth/MFA onboarding приведён к backend-контракту: первый admin login показывает пошаговую ручную TOTP-настройку, безопасную otpauth-ссылку, копирование секрета и recovery-кодов, numeric validation и доступные ошибки; sign-in/MFA copy и иерархия согласованы с UI-макетами. Четыре темы теперь управляют native color-scheme и на служебных shell без принудительной тёмной схемы. Настройки уведомлений, рецептов и центр уведомлений сохраняют общий admin shell; его типографика, overlay и touch-targets используют дизайн-токены. Таблицы сравнения контента, отката и Free AI на узких экранах преобразуются в подписанные label/value-карточки без горизонтального переполнения. OpenAPI не менялся; отсутствие reset/re-enrollment и service-account endpoint зафиксировано как backend-блокер.

0.0.128 - 29.10.2026 | 18:22 - Release metadata синхронизирована с backend runtime 0.0.152 после устранения APP_VERSION drift; OpenAPI 0.0.61, schema v31 и wire-контракты не менялись.

0.0.127 - 29.10.2026 | 18:05 - OpenAPI metadata синхронизирована с backend 0.0.151 / additive schema v31 для транзакционной account-mail очереди; wire paths и payload не менялись. Generated contracts, package/lock и deployment target обновлены.

0.0.126 - 29.10.2026 | 16:53 - Синхронизированы полный OpenAPI snapshot 0.0.61, generated metadata и production-документация с фактическим Docker release admin 0.0.125: backend 0.0.149 / schema v30, healthy container image ID и CI/deploy evidence, текущий technical origin и pending-DNS custom origin. Legacy symlink-процедура заменена актуальным immutable digest/helper rollout, verify и rollback runbook; wire paths и payload не менялись.

0.0.125 - 29.10.2026 | 16:14 - Добавлен production-ready экран «Приёмочное тестирование» по выбранному двухпанельному варианту: versioned server catalog на 83 кейса, поиск/фильтры/прогресс, статусы и комментарии, CAS/idempotent save/reset с exact retry и readback reconciliation, responsive/a11y состояния, typed mock, route и документация. Все четыре темы используют только semantic tokens дизайн-системы.

0.0.123 - 29.10.2026 | 12:37 - Закрыт остаточный архитектурный checkpoint admin SPA: все route-level feature imports проходят через public client API с сохранением lazy boundaries, architecture gate проверяет static/dynamic imports и mock composition, browser mocks вынесены из shared/features в app adapter. Release workflow разделён на public entry, list/detail, draft hook и model без изменения URL/wire/exact-action семантики; auth CSS локализован, неиспользуемые landing styles удалены.

0.0.122 - 29.10.2026 | 10:17 - В admin deployment runbook добавлена короткая операторская карта и зафиксирован фактический Docker cutover: `main` → checks → GHCR digest → allowlisted helper → loopback `3002`/host Nginx, health, MFA/theme smoke и UI-only rollback boundary; legacy symlink оставлен только как evidence, секреты не добавлялись.

0.0.121 - 29.10.2026 | 10:07 - Admin CI передаёт dedicated `QA_OUTPUT_DIR` не только quality gate, но и Playwright `--list`, поэтому workflow больше не падает на fail-closed проверке временного каталога; runtime, wire-контракты и design-system не изменялись.

0.0.120 - 29.10.2026 | 10:03 - GitHub Actions check переносит `QA_OUTPUT_DIR` с job-level на step-level `env`, где `runner.temp` доступен; устранён fail до создания job без изменения admin runtime, wire-контрактов и design-system.

0.0.119 - 28.10.2026 | 17:50 - Добавлен container delivery path административной SPA: real-only multi-stage image на digest-pinned Node/Nginx, unprivileged Nginx на 8080 с `/healthz`, SPA/cache/security boundary и fail-closed `/api`; production artifact gate исключает mock worker, source maps и env-файлы. GitHub workflow после успешного main-check дважды блокирует stale SHA, использует commit tag и immutable GHCR digest с provenance/SBOM, а все Actions закреплены по commit SHA; rollout передаётся защищённому allowlisted server helper. Live deployment не выполнялся, wire-контракты и design-system не менялись.

0.0.118 - 28.10.2026 | 13:24 - Актуализирован тестовый checkpoint: full mock Playwright E2E прошёл `134/134` за `10.7m` в system Edge, desktop/mobile `67/67`, один worker и без retry. Зафиксированы также unit `117/117`, contracts `102`, build `282` modules и production smoke live SPA `0.0.117`. Runtime-код и развёрнутый artifact не менялись.

0.0.117 - 28.10.2026 | 13:05 - Удалены все 10 legacy-зависимостей mock adapters от feature UI: общие контракты и модели content release, news, admin notifications и operations перенесены в entity-слой с совместимыми feature re-export; architecture gate теперь запрещает любые mocks-to-features imports без allowlist. Runtime, маршруты, wire-контракты и семантика fixtures не менялись. Production build развёрнут в immutable release `20261028-0757`; root/deep-link, password → MFA и `coffee-light` / `nature-dark` smoke прошли без runtime-ошибок.

0.0.116 - 28.10.2026 | 12:38 - Deployment inventory синхронизирован с live frontend root/app `0.0.28` / `0.0.137` и immutable release `20261028-0735`; зафиксирован read-only desktop/mobile acceptance 24/24 без mutation requests и runtime errors. Live admin остаётся `0.0.114`; runtime-код и публичные контракты не менялись.

0.0.115 - 28.10.2026 | 12:16 - Документационная ревизия фиксирует завершённый admin-first rollout: live SPA 0.0.114 в immutable release 20261028-0705, backend 0.0.128/schema v29, HTTPS root/deep-link 200, обязательную MFA-границу, четыре темы и сохранение зелёной тёмной темы без console errors. Секреты и test credentials в Git не добавлялись; runtime-код и публичные контракты не менялись.

0.0.114 - 28.10.2026 | 11:13 - Добавлен безопасный admin-first rollout revision-aware контракта: ApiClient до generated parse принимает только полностью legacy content response без обеих осей, не маскирует partial schema drift, не отправляет `publicReason` старому strict backend и сбрасывает capability вместе с auth context. Новый backend сохраняет строгие review/publication DTO; critical gate также блокирует точный replay и catalog merge после истечения подтверждения. Runbook фиксирует порядок deploy admin→backend/schema и rollback backend→admin.

0.0.113 - 28.10.2026 | 11:04 - Admin recipe moderation синхронизирована с backend 0.0.128 / OpenAPI 0.0.60 / schema v29: независимые review/publication оси сохраняют отклонённую r2 рядом с опубликованной r1, publicReason отделён и санитизирован от внутренних заметок, full admin approve сразу заменяет публикацию, hide/unpublish защищены revision/CAS и свежим critical confirmation. Обновлены development-моки, unit/desktop/mobile E2E и production runbooks; live 0.0.110 не менялся.

0.0.112 - 27.10.2026 | 18:57 - React Router вынесен из входного production chunk в отдельный cacheable vendor chunk: максимальный gzip снижен с 102 545 до 86 750 байт без ослабления browser budget, изменения маршрутов, UI или публичных контрактов.

0.0.111 - 27.10.2026 | 18:47 - Добавлен самостоятельный production deployment/rollback runbook для статической admin SPA: immutable release и checksum, атомарный `current`, Nginx SPA/API boundary, readiness, password→обязательный MFA, deep-link/theme/session smoke, очистка и известные gates; в ручной приёмке исправлены канонические health URL.

0.0.110 - 27.10.2026 | 17:10 - Content exact retry после `403` ожидает актуальный auth status: истёкшее critical confirmation предлагает повторную MFA, а при активном confirmation показывает запрет роли/разрешения без бесполезного TOTP; frozen command/key остаются доступны для точного повтора после восстановления роли, тогда как protected `401` документирован как auth recovery + обязательный readback без обещания пережить remount.

0.0.109 - 27.10.2026 | 16:56 - Exact replay content merge сохраняет полный frozen command после истёкшего critical confirmation: `403` предлагает повторно пройти TOTP/recovery и затем отправить прежний idempotency key; mock 0.0.119 проверяет critical до journal replay, а unit и Edge desktop/mobile подтверждают один merge/history/audit после commit-before-failure и повторного подтверждения.

0.0.108 - 27.10.2026 | 16:43 - Moderation и catalog merge выделены в `content-workflow` bounded context с entity-owned contracts/session-scoped cache и public client API; unknown outcome замораживает полный command и допускает только dedicated exact retry, conflict ожидает workspace/admin-record readback, а mock journal повторяет backend identity actor + operation + target + key и запрещает повторное закрытие exact not-duplicate pair новым ключом.

0.0.107 - 27.10.2026 | 15:39 - Legal review и rollback оформлены как compliance bounded context с public client API, entity-owned contracts и session-scoped cache; rollback и account-deletion замораживают полный command для exact retry, ожидают readback после конфликта и не дублируют effect/audit при потерянном ответе; новая осознанная проверка retention state использует новый idempotency key, а terminal/unknown lifecycle отображается только для чтения.

0.0.106 - 27.10.2026 | 15:21 - Billing выделен в bounded context с public client API и session-scoped cache; финансовые 409 ожидают readback и сбрасывают preview, unknown outcome допускает только exact retry, неконсистентный ledger и невозможные переходы блокируются, refund остаётся fail-closed до подключения провайдера.

0.0.105 - 27.10.2026 | 15:06 - Governance и Free AI объединены в bounded context `user-governance` с public client API и session-scoped `user-access` cache; 409 ожидает readback и сбрасывает critical preview, unknown outcome разрешает только exact retry, исправлены тексты семейного Plus и фактических уведомлений.

0.0.104 - 27.10.2026 | 14:55 - Support выделен в самостоятельный домен с public client API, приватным CSS и session-scoped `support-ticket` cache; success/409 атомарно обновляют ticket aggregate, unknown outcome сохраняет точный payload/idempotency key и объясняет безопасный повтор, добавлен browser regression exact retry.

0.0.103 - 27.10.2026 | 14:42 - Generic admin-record UI выделен в самостоятельный content-only feature со slot-контрактом; междоменная композиция support, governance, billing, moderation, compliance и operations перенесена в widget, app больше не импортирует god-feature, а architecture gate запрещает возврат sibling feature dependencies.

0.0.102 - 27.10.2026 | 14:32 - Generic admin record получил entity public API, pure presentation и единый session-scoped namespace `admin-record`; list/detail/filter/related caches больше не смешивают accountId и sessionId, удалён невозможный undefined-invalidation, доменные readback invalidations используют canonical root.

0.0.101 - 27.10.2026 | 14:26 - Fail-closed session guard перенесён на router level, поэтому private routes не монтируют запросы до проверки staff session; AdminShell стал widget, section/navigation model — entity, локальные Guard/Shell wrappers удалены, а mock→auth debt сокращён до 14 edges.

0.0.100 - 27.10.2026 | 14:17 - Staff session оформлена как entity с каноническим cache key, transport cancellation вынесен в shared/api, а auth открыл единый client API; app, домены и mock console больше не импортируют auth internals, возврат deep imports блокируется architecture gate.

0.0.99 - 27.10.2026 | 14:12 - Зафиксирована доменная FSD-подобная архитектура админки; runtime и ThemeControl вынесены из app/legacy ui в shared public APIs, устранены feature→app зависимости и добавлен architecture gate с учётом 15 явно отслеживаемых mock-contract debt edges.

0.0.98 - 27.10.2026 | 11:05 - Production build развёрнут на `https://admin.abstract-usable-gazebo.ruweb.place` как статическое SPA за Nginx/TLS с same-origin `/api`. Деплой-smoke подтвердил парольный этап, обязательный TOTP, admin session/unlock, загрузку dashboard и переключение четырёх тем без ошибок консоли.

0.0.97 - 10.26.2026 | 14:45 - Production-приёмка: 104 desktop/mobile e2e, надёжный touch-сценарий релиза, внешний Chromium для Playwright, четыре сохраняемые темы без стартовой вспышки, прикладные цвета сведены к токенам, добавлены browser bundle budgets и подробное руководство ручного тестирования, включая рендеринг и утечки.

0.0.96 - 10.24.2026 | 20:00 - Самостоятельный репозиторий админки, независимые зависимости и проверки; очистка истёкшего tab proof до подтверждения auth/me; Vite 8.2.4 закрывает dev security advisories; локальный preview проксирует /api к loopback backend.

0.0.95 - 10.24.2026 | 18:34 - Перенос в самостоятельный meal_frontend; переносимые проверки и отсутствие зависимости от исходников backend.

0.0.90 - 10.14.2026 | 15:21 - Контракт синхронизирован с migration 027 и account-deletion blocker export_not_ready; административный интерфейс не менялся.

0.0.89 - 10.14.2026 | 16:20 - Добавлена трёхитерационная desktop/mobile приёмка operations UI: retry/cancel background job и полный incident lifecycle с readback после reload; 12/12 PASS.

0.0.88 - 10.14.2026 | 15:30 - Billing workspace поддерживает provider-independent Plus/Pro gift и блокирует повторный grant при активном/замороженном периоде; три Edge desktop/mobile итерации дали 18/18 PASS.

0.0.87 - 10.14.2026 | 12:30 - В user detail подключён существующий billing workspace: Plus-подарок теперь можно выдать из интерфейса; desktop/mobile тест подтверждает preview, critical TOTP, запись, readback и reload.

0.0.86 - 10.14.2026 | 03:23 - Auth cover и brand получили фактически размерные WebP-варианты; production Slow 4G + 4×CPU auth и все 18 authenticated workspaces проходят три desktop/mobile итерации.

0.0.85 - 10.14.2026 | 02:20 - Browser telemetry error handlers защищены от повторной установки при dev/HMR; три 30-minute desktop/mobile authenticated soak-сессии по всем admin routes прошли без heap/DOM/listener/CLS/error regression.

0.0.84 - 10.14.2026 | 00:26 - Mobile news workspace резервирует стабильную прокручиваемую область для асинхронного списка новостей, устраняя сдвиг редактора после загрузки.

0.0.83 - 10.13.2026 | 23:59 - Auth/brand raster assets переведены на WebP без изменения layout; исходные PNG сохранены для отката, итоговый transfer проверяется production browser baseline.

0.0.82 - 10.13.2026 | 23:58 - Устранён layout shift экрана входа и production 404 favicon; runtime Zod-контракты админки ограничены используемыми admin/staff/auth namespaces вместо доставки всех 347 API-операций.

0.0.81 - 10.13.2026 | 17:36 - Browser-smoke поддерживает системный браузер, проверяет все 18 разделов, а безопасный returnTo сохраняет реальные маршруты релизов и специальных каталогов после повторной MFA-проверки.

0.0.80 - 10.13.2026 | 16:28 - Зафиксированы актуальные 18 разделов админки, включая errors и metrics; browser-smoke evidence и QA-документы синхронизированы с фактической навигацией.

0.0.79 - 10.13.2026 | 13:27 - OpenAPI snapshot и generated contracts синхронизированы до 0.0.60 с register/v2, legal manifest и раздельными consent state/history/accept/revoke; UI не менялся.

0.0.78 - 12.10.2026 | 18:34 - Черновики content/legal releases перенесены из глобального localStorage в очищаемый при logout sessionStorage; для effectiveAt добавлены явная локальная зона и UTC-preview.

0.0.77 - 12.10.2026 | 17:28 - Админка получила first-party browser telemetry и отдельные root/route boundaries; разделы ошибок и метрик теперь принимают безопасные события backend/front/admin/workers/providers, контракт синхронизирован до OpenAPI 0.0.59.

0.0.76 - 10.09.2026 | 20:45 - Финализирован Design QA: admin mobile drawer использует native modal focus containment и корректный hidden closed-state, controls нормализованы до 44px, а review/content таблицы получили безопасную горизонтальную область на узком viewport; дизайн-система 0.0.7.

0.0.75 - 10.09.2026 | 15:54 - Design QA: глобальные текстовые действия получили mobile-safe touch-target, а заголовки и preview release/catalog переходят в колонку на узком viewport.

0.0.74 - 10.09.2026 | 12:25 - OpenAPI-снимок синхронизирован до 0.0.58 с платным lifecycle Pro; admin UI не менялся.

0.0.73 - 10.09.2026 | 11:42 - OpenAPI-снимок синхронизирован до 0.0.57 с Pro export manifests; admin UI не менялся.

0.0.72 - 10.09.2026 | 10:58 - OpenAPI-снимок синхронизирован до 0.0.56 с Pro AI orchestration; admin UI не менялся.

0.0.71 - 10.08.2026 | 18:45 - OpenAPI-снимок синхронизирован до 0.0.55 с deterministic-v1 Pro plan optimization; admin UI не менялся.

0.0.70 - 10.08.2026 | 18:20 - OpenAPI-снимок синхронизирован до 0.0.54 с Pro-only календарём плана; admin UI не менялся.

0.0.69 - 10.08.2026 | 18:05 - OpenAPI-снимок синхронизирован до 0.0.53 с private Pro finance analytics; admin UI не менялся.

0.0.68 - 10.08.2026 | 17:07 - OpenAPI-снимок синхронизирован до 0.0.52 с Pro receipt contracts и receipt provenance; admin UI не менялся.

0.0.67 - 10.08.2026 | 16:38 - Локальный OpenAPI-снимок синхронизирован до 0.0.51 с Pro price observations и cost estimates; admin UI и поведение не менялись.

0.0.66 - 10.08.2026 | 15:42 - Локальный OpenAPI-снимок синхронизирован до 0.0.50 с пользовательскими private finance contracts; admin UI и поведение не менялись.

0.0.65 - 10.08.2026 | 15:03 - Локальная зависимость обновлена до design-system 0.0.6 с единым узким theme-aware scrollbar без browser arrows; admin UI и бизнес-поведение не менялись.

0.0.64 - 10.08.2026 | 14:49 - Локальная зависимость обновлена до design-system 0.0.5 с auth mobile breakpoint 900 px и вертикальной card-композицией; admin business behavior не менялся.

0.0.63 - 10.08.2026 | 14:32 - Локальная зависимость синхронизирована с design-system 0.0.4 после responsive-исправления PublicShell; admin ServiceShell/AuthShell не менялись, check/build прошли.

0.0.62 - 10.08.2026 | 14:09 - Admin и auth переведены на DS ServiceShell/AuthShell; React Router и guards остались локальными, для reauth подключён существующий зелёный selected-ассет без новых макетов.

0.0.61 - 10.08.2026 | 13:08 - Локальная зависимость обновлена до design-system 0.0.2 с router-agnostic application shell; admin UI в этой итерации не мигрировался.

0.0.60 - 10.08.2026 | 12:24 - Подключён локальный Meal Planner Design System: nature-dark по умолчанию, четыре темы, общий theme switcher и loading primitives в admin/auth оболочках; API/моки без изменений.

0.0.59 - 10.08.2026 | 11:25 - Generated contracts синхронизированы с OpenAPI 0.0.49 и пользовательским nutrition profile/targets/analytics API; административный UI не менялся.

0.0.58 - 10.08.2026 | 10:24 - Generated contracts синхронизированы с OpenAPI 0.0.48: diary portion decisions и fail-closed media boundary; административный UI не менялся.

0.0.57 - 10.07.2026 | 20:13 - Синхронизирован generated OpenAPI 0.0.47 с пользовательским private diary; административный UI не менялся.

0.0.56 - 07.10.2026 | 19:21 - Сгенерированные административные контракты синхронизированы с OpenAPI 0.0.46 и пользовательским `GET /api/v1/pro/overview`; административный UI не менялся.

0.0.55 - 07.10.2026 | 18:29 - Тесты приведены к fail-closed refund/storage и расширенному rollback registry; Free AI projection включает requiresConfirmation, полный admin-набор проходит.

0.0.54 - 07.10.2026 | 17:46 - Support mock больше не имитирует загрузку и скрытие файлов; медиа-действия явно недоступны до storage/scanner.

0.0.53 - 07.10.2026 | 17:28 - Legal review mock больше не создаёт фиктивный export archive; UI оставляет preview и явно блокирует подготовку до защищённого storage.

0.0.52 - 07.10.2026 | 17:05 - Refund mock приведён к backend boundary: preview остаётся, выполнение и изменение ledger недоступны до provider/reconciliation.

0.0.51 - 06.10.2026 | 14:57 - News workspace и mock синхронизированы с backend: in-app delivery сохраняется, email/push launch/test явно выключены до провайдеров.

0.0.50 - 06.10.2026 | 14:48 - Review mock переведён на отдельный строгий rollback registry с тем же whitelist, version/state conflict и blocked external delivery, что и backend.

0.0.49 - 06.10.2026 | 14:03 - Billing workspace ограничен Plus: вариант Pro скрыт, backend-команды подключены; OpenAPI остаётся 0.0.45.

0.0.48 - 06.10.2026 | 13:41 - В карточке account_deletion добавлено критичное approve/reject с основанием, version guard, audit и mock parity; без нового макета.

0.0.47 - 06.10.2026 | 13:20 - Синхронизирован общий OpenAPI 0.0.45 с отдельным moderator API; admin UI не менялся.

## 0.0.46 — 6 октября 2026

OpenAPI синхронизирован до 0.0.44 (296 операций). В существующий экран состава релиза добавлены canonical-редакторы контентных документов и справочников: create/update/retire, namespace-specific metadata, локали, schema-safe ключи, diff текущего и подготовленного состояния, конфликты версий и новая редакция из актуальных sources. Development-мок хранит тестовые placeholder sources и восстанавливает документы/справочники при rollback. Иконки справочников используют metadata и project-owned raster fallback; локальный PNG/WebP preview не выдаётся за production upload, который остаётся fail-closed до storage/scanner. Realtime-редакторы и lifecycle-экран не менялись. Тесты и browser QA по действующему поручению не запускались.

## 0.0.45 — 6 октября 2026

Условия достижений переведены на typed aggregate-v1 authoring: администратор выбирает метрику из серверного allowlist, оператор `gte`/`eq` и целый неотрицательный порог; композиция `all` сохраняется только для правил, которым она действительно нужна. Все 60 development-примеров получили точные условия, включая составное правило недели без просрочек и скрытые условия секретных достижений. Неизвестный legacy JSON показывается только для чтения, сохраняется без потерь и блокирует добавление изменения в релиз до ручной миграции. OpenAPI остаётся 0.0.42, lifecycle-экран не добавлялся. Тесты и browser QA по действующему поручению не запускались.

## 0.0.44 — 6 октября 2026

Добавлены административные релизы по согласованному варианту 1: список и неизменяемая история, серверный черновик с SHA-256 autosave и localStorage safety-cache, конфликт версий, проверка, критично подтверждённые публикация/откат и новая редакция из актуальных источников. Каталог поддерживает создание, изменение и снятие публичных достижений только через релиз; development-мок содержит согласованные 60 примеров из шести групп. Редактор репутации содержит ровно 10 согласованных порогов и preview рейтинга. В релиз также добавляются юридические тексты и описания продуктов из server sources. Иконки используют project-owned raster assets; локальный PNG/WebP preview не выдаётся за production upload, который остаётся fail-closed до storage/scanner. OpenAPI 0.0.42, 288 операций. Тесты и browser QA по действующему поручению не запускались.

## 0.0.43 — 6 октября 2026

Выбор обычной новости/важного объявления без изменения старых записей; синхронизация OpenAPI 0.0.41 с публичными сценариями Free/Plus. News persistence/in-app публикация подготовлены в backend; email/push/scheduler не имитируют успех. Проверки: docs/free-plus-completion-iteration.md от корня проекта.

## 0.0.42 — 5 октября 2026

Добавлен «Каталог → Аллергены»: поиск, связи ingredient/variant/product с выбором по названию, отдельные счётчики, пиктограммы, предпросмотр и подтверждение замены/удаления. Development upload сохраняет выбранное изображение в mock-состоянии; реальный upload недоступен до storage/scanner. OpenAPI 0.0.40; адаптивность по существующим паттернам без mobile-макетов. Тесты и browser QA не запускались.

## 0.0.41 — 5 октября 2026

Контракты синхронизированы с OpenAPI 0.0.38 после добавления отдельного API персональных рекомендаций, событий выдачи и подписки на авторов. Административный UI не менялся; полный allergen-report/admin workflow ожидает согласованного макета. Тесты и browser QA не запускались.

## 0.0.40 — 5 октября 2026

Контракты синхронизированы с OpenAPI 0.0.37 после добавления пользовательского управления trial и Free/Plus. Административный UI не менялся; тесты не запускались. Подробности: ../docs/subscription-trial-iteration.md.

## 0.0.39 — 5 октября 2026

Версия синхронизирована с frontend-итерацией семейной области по умолчанию. Административный UI и OpenAPI 0.0.36 не менялись; тесты не запускались.

## 0.0.38 — 5 октября 2026

Контракты синхронизированы с OpenAPI 0.0.36 после добавления preview перераспределения семейной AI-квоты. Административный UI не менялся; тесты не запускались.

## 0.0.37 — 5 октября 2026

Контракты синхронизированы с OpenAPI 0.0.35 после добавления семейных передач AI-действий. Административный UI не менялся; тесты не запускались.

## 0.0.35 — 1 октября 2026

Добавлен раздел семей с составом и покрытием Plus, а форма немедленного бана владельца умеет сохранить семейное покрытие или передать подписку выбранному участнику с уведомлением семьи. Моки и generated DTO синхронизированы с OpenAPI 0.0.33.

## 0.0.34 — 1 октября 2026

Синхронизированы OpenAPI 0.0.32 и generated DTO автоматизации планирования Plus. Административные экраны не менялись.

## 0.0.33 — 1 октября 2026

Синхронизированы OpenAPI 0.0.31 и generated DTO QR-этикеток заготовок. Административные экраны не менялись.

## 0.0.32 — 1 октября 2026

Синхронизированы OpenAPI 0.0.30 и generated DTO семейного чата. Административные экраны не менялись.

## 0.0.31 — 1 октября 2026

Синхронизированы OpenAPI 0.0.29 и generated DTO семейных заметок и чек-листов. Административные экраны не менялись.

## 0.0.30 — 1 октября 2026

Синхронизированы OpenAPI 0.0.28 и generated DTO семейного плана и назначений готовой еды. Административные экраны не менялись.

## 0.0.29 — 1 октября 2026

Синхронизированы OpenAPI 0.0.27 и generated DTO общих покупок/чеков. Административные экраны не менялись.

## 0.0.28 — 1 октября 2026

Синхронизированы OpenAPI 0.0.26 и generated DTO для семейной доступности рецептов. Административные экраны не менялись; admin-набор — 85/85.

## 0.0.27 — 1 октября 2026

Синхронизированы OpenAPI 0.0.25 и generated DTO для private/family inventory scope. Административные экраны не менялись.

## 0.0.26 — 1 октября 2026

Синхронизированы OpenAPI 0.0.24 и generated DTO семейного lifecycle. Административные экраны не менялись; 85 тестов.

## 0.0.25 — 1 октября 2026

Синхронизирован общий OpenAPI 0.0.23 с пользовательскими entitlement/family endpoints. Административные экраны в этой итерации не менялись.

## 0.0.24 — 1 октября 2026

Admin-интерфейс и development-моки санкций, поддержки, moderation/catalog и operations теперь соответствуют реальным backend-контрактам OpenAPI 0.0.22. Тяжёлые workspace, новости и настройки загружаются по маршрутам; provider-зависимые действия сохраняют явные недоступные состояния.

## 0.0.23 — 1 октября 2026

В карточке пользователя добавлен workspace Free AI: баланс, резерв, buckets, история списаний, preview и критичная выдача пробной квоты с идемпотентным повтором. Billing-формы Plus/Pro убраны из карточки пользователя и остались в профильных разделах. Моки заполнены для Free-сценариев и синхронизированы с OpenAPI 0.0.21; admin-набор — 85/85.

## 0.0.22 — 30 сентября 2026

Generated DTO синхронизированы с OpenAPI 0.0.20 для чтения и продолжения пользовательских AI-бесед. Интерфейс админки не менялся; полный admin-набор проверяется общей итоговой итерацией.

## 0.0.21 — 30 сентября 2026

Generated DTO синхронизированы с OpenAPI 0.0.19 серверной AI orchestration. Интерфейс админки не менялся. Тесты не запускались.

## 0.0.20 — 30 сентября 2026

Generated DTO синхронизированы с OpenAPI 0.0.18 AI-инфраструктуры. Интерфейс админки не менялся. Тесты не запускались.

## 0.0.19 — 30 сентября 2026

Generated DTO синхронизированы с OpenAPI 0.0.17 пользовательской поддержки. Интерфейс админки не менялся. Тесты не добавлялись и не запускались.

## 0.0.18 — 30 сентября 2026

Синхронизация generated DTO с OpenAPI 0.0.16 пользовательских уведомлений и предпочтений. Интерфейс админки не менялся. Тесты не добавлялись и не запускались.

## 0.0.17 — 30 сентября 2026

Синхронизация generated DTO с OpenAPI 0.0.15 для главной, онбординга, предпочтений и редактирования пользовательского профиля. Интерфейс админки не менялся. Тесты не добавлялись и не запускались.

## 0.0.16 — 30 сентября 2026

Синхронизация generated DTO с OpenAPI 0.0.14 и полем фактического времени offline-команды готовки. Административный интерфейс не меняется. Тесты не добавлялись и не запускались.

## 0.0.15 — 30 сентября 2026

Синхронизация OpenAPI 0.0.13 с личным планом питания Free. Административный интерфейс не меняется. Тесты по поручению пользователя не добавлялись и не запускались.

## 0.0.14 — 30 сентября 2026

Синхронизация OpenAPI 0.0.12 с личными покупками, покупками-поступлениями и фото-чеками Free. Административный интерфейс не меняется. Тесты по поручению пользователя не добавлялись и не запускались.

## 0.0.13 — 29 сентября 2026

Синхронизация OpenAPI 0.0.11 с личными заготовками и физическими контейнерами. Административный интерфейс не меняется. По поручению пользователя тесты не добавлялись и не запускались.

## 0.0.12 — 29 сентября 2026

Синхронизация OpenAPI 0.0.10 с пользовательскими настройками напоминаний и архивом готовки. Административный интерфейс не меняется. По поручению пользователя тесты не добавлялись и не запускались.

## 0.0.11 — 29 сентября 2026

Отдельная вкладка /settings/recipes: лимиты отправок на модерацию, комментариев и жалоб, версия/аудит/критичное подтверждение. OpenAPI 0.0.9, поддержка CSRF для PUT/PATCH. Проверки: ../docs/recipe-workflows-iteration.md.

0.0.10 - 09.29.2026 | время не фиксировалось - Синхронизация локального OpenAPI0.0.8 и generated DTO с recipes-контрактами основного приложения. Новая административная бизнес-логика/persistence не добавлена; существующие workspace503 сохранены.

0.0.9 - 09.28.2026 | время не фиксировалось - Синхронизация локального снимка и генерации OpenAPI0.0.7 с добавленными продуктовыми/inventory-контрактами основного приложения. Новые административные возможности и persistence не добавлены; прежние real workspace остаются503.

0.0.8 - 09.28.2026 | время не фиксировалось - Доменные административные интерфейсы и заполненные development-моки: санкции/права, подписки/возвраты, поддержка, модерация/каталог, новости, уведомления, задачи/инциденты, правовые запросы/откаты. Панель сценариев normal/empty/error/conflict; OpenAPI0.0.6. Новые real workspace возвращают503 до persistence; доставка, файлы и PostgreSQL не подключены. Матрица: ../docs/admin-ui-readiness.md.

0.0.7 - 09.28.2026 | время не фиксировалось - Повторная проверка16 разделов: смысловые ссылки обзора, перевод статусов, точное отображение RUB, понятные404/подсказки поиска, навигация настроек, предупреждение устаревшей переписки, доступное мобильное меню и фокус при переходах. Backend/API/БД не менялись.

0.0.6 - 09.28.2026 | время не фиксировалось - Username-вход, TOTP при повторном открытии, семидневная сессия без продления, отдельное подтверждение критичных действий TOTP/резервным кодом на30минут. Моки, UI и OpenAPI0.0.5 синхронизированы; исходные user/moderator сценарии сохранены.

0.0.5 - 09.28.2026 | время не фиксировалось - Общие hover/active/focus/disabled состояния интерактивных элементов, переходы 0.2s и поддержка reduced motion; правило закреплено в инструкции агента.

0.0.4 - 09.28.2026 | время не фиксировалось - Единая тёмно-зелёная палитра административных макетов для входа, MFA, сессий, уведомлений и всех разделов; общие цвета форм, ошибок, кнопок и загрузки. Прежняя светлая тема больше не применяется.

0.0.3 - 09.28.2026 | время не фиксировалось - Административная навигация16 разделов, типизированные read-проекции/моки, Nest admin/auth и настройки уведомлений, согласованные команды поддержки. API0.0.4; критичные неуточнённые действия недоступны. PostgreSQL, доставка уведомлений и deployment не выполнялись.

0.0.2 - 09.28.2026 | 13:06 - Переход на React SPA/Vite/React Router вместо Next, сохранение auth/MFA и проверок; защищённые настройки браузерных, мобильных push и email-уведомлений с изолированным mock-хранением. Реальная доставка и Nest-подключение отложены, БД не менялась.

0.0.1 - 09.28.2026 | 12:38 - Инициализация независимого административного frontend на согласованном стеке основного приложения: собственные зависимости, контракты, линтеры, CI, UI-примитивы и инструкции агента; административная авторизация в рамках первого среза.

## 0.0.36 — 5 октября 2026

Снимок OpenAPI и генерируемые типы синхронизированы с контрактом 0.0.34 семейного AI-резерва. Административный UI не менялся; тесты не запускались.

0.0.91 - 10.14.2026 | 18:15 - Версионный checkpoint общей QA-итерации: backend admin exact coverage 37/37 и три fresh-PG прогона подтверждены; admin UI новых изменений на этом шаге не получал, финальная синхронизация OpenAPI отложена до возобновления.

0.0.92 - 10.15.2026 | 18:59 - Admin residual Edge actions завершены 168/168; Firefox/WebKit I1 завершён 200/200. Исправлены tab-bound unlock proof, release hydration/autosave race, unknown achievement detail и route metadata; unit 90/90, type/lint/style/format/build PASS. Cross-browser I2/I3 оставлены точкой продолжения.

0.0.93 - 10.20.2026 | 21:42 - Admin Firefox/WebKit action sweep завершён тремя fresh-server итерациями: 600/600 без retry/flaky/skip. Стабилизированы MFA/tab unlock, release conflicts и exact action assertions; contracts/type/lint/style/format, unit 90/90 и production build PASS.

0.0.94 - 10.22.2026 | 13:47 - Administrative frontend документация сведена к актуальным README/AGENTS и TESTs.md; удалены старые acceptance/audit/handoff-документы и дубли инструкции без изменения runtime и API.

0.0.124 - 10.29.2026 | 15:18 - Добавлена read-only страница «Состояние системы» по финальному backend-контракту observability: 6 секций, ручное обновление, partial/stale/unavailable/no-samples/error состояния, typed mocks, FSD public API, route/navigation и тестовое покрытие.

0.0.131 - 11.02.2026 | 14:18 - Синхронизированы OpenAPI/HTTP snapshots с backend 0.0.160, OpenAPI 0.0.63 и schema v33; regenerated admin client проверяет 106 разрешённых операций и намеренно исключает user-session media endpoints. README и TESTs фиксируют fail-closed границу до отдельного staff media-контракта и VPS capacity/OOM drill.
