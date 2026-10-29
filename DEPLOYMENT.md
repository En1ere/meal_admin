# Deployment Meal Admin

Актуально на 29 октября 2026 года. Документ описывает тестовый production-стенд и воспроизводимый выпуск самостоятельной административной SPA. Он не содержит пароль администратора, TOTP secret, recovery-коды, cookies, root-доступ, строки подключения или содержимое env-файлов.

## Быстрая карта деплоя

1. В `meal_admin` заливаются admin SPA, её design-system и admin-тесты; backend/Compose здесь не меняются.
2. Push в `main` запускает `Admin checks`; только success запускает `.github/workflows/deploy.yml` через `workflow_run`.
3. Image: `ghcr.io/en1ere/meal_admin:sha-<full-sha>`; на VPS передаются только immutable `@sha256:` и source SHA.
4. CI вызывает `sudo /usr/local/sbin/meal-deploy admin <image@digest> <git-sha>`. Копировать `build/` в старый `/srv/meal/admin/current` после cutover не нужно.
5. Container `8080` публикуется только на `127.0.0.1:3002`; host Nginx отдаёт admin HTTPS, а `/api/` направляет прямо в backend `3001`.
6. Smoke: local `/healthz`, public `/`, `/auth`, `/admin/queues/recipes`, затем password → mandatory MFA → dashboard/logout и theme switcher.
7. Admin rollout не ходит в БД и не запускает migrations; при verify failure helper возвращает previous admin digest.

## Адрес и подтверждённый release

| Параметр         | Значение                                                  |
| ---------------- | --------------------------------------------------------- |
| Публичный origin | `https://admin.abstract-usable-gazebo.ruweb.place`        |
| Custom origin    | `https://admin.meal.royalexander.online` — pending DNS    |
| Активный release | source `5f944b2`; container image ID `43e8bd3b0551`       |
| Live-версия      | `0.0.125`                                                 |
| Репозиторий      | `0.0.127` (schema v31 contract sync)                      |
| Contract/schema  | OpenAPI `0.0.61`, backend `0.0.151`, schema `v31`         |
| Точка выдачи     | container `8080` → host loopback `127.0.0.1:3002`         |
| API              | same-origin `/api`, proxy на `http://127.0.0.1:3001`      |
| Liveness         | `https://abstract-usable-gazebo.ruweb.place/health/live`  |
| Readiness        | `https://abstract-usable-gazebo.ruweb.place/health/ready` |

С 29 октября live SPA выдаётся непривилегированным Docker-контейнером; legacy symlink `/srv/meal/admin/current` сохранён только как rollback-evidence и больше не является traffic source. Общий стек после reboot поднимает `meal-planner-compose.service`; backend, PostgreSQL, TLS и сетевая граница описаны в `meal_backend/docs/DEPLOYMENT.md`.

Полный активный `ghcr.io/...@sha256:...` является source of truth только в root-owned server inventory (`images.env` и журнал deploy-helper). Документация не подменяет его сокращённым digest. До появления A-записи `admin.meal.royalexander.online → 91.201.42.153`, отсутствия конфликтующего AAAA, выпуска сертификата и полного smoke технический origin остаётся каноническим и Nginx cutover на custom domain запрещён.

## Контейнерный delivery path

`Dockerfile` собирает real-only SPA на Node.js из `.node-version`, проверяет manifest version, production artifact и browser budget, затем переносит только `build` в unprivileged Nginx. Runtime слушает только внутренний `8080`; `/healthz` возвращает container liveness. Development `mockServiceWorker.js`, source maps и env-файлы блокируются artifact gate.

Контейнер не проксирует API. Его `/api` и `/api/` намеренно отвечают `404`, чтобы ошибочная gateway-маршрутизация не вернула SPA HTML вместо API-ответа. Host Nginx завершает TLS и для admin origin направляет `/api/` напрямую в backend, а остальные пути — в admin container. В Compose порт `8080` публикуется только на host loopback `127.0.0.1:3002`; runtime запускается с `read_only: true`, tmpfs `/tmp`, `cap_drop: [ALL]` и `no-new-privileges`.

`.github/workflows/deploy.yml` запускается только после успешного `Admin checks` для push в `main`. Он checkout-ит проверенный `head_sha`, перед build и повторно перед deploy fail-closed сверяет его с актуальным tip `refs/heads/main`, публикует в GHCR только commit tag `sha-<full-sha>`, а deploy передаёт защищённому server helper только image reference с registry digest и source SHA. Mutable `latest` и semver tags, парольный SSH и inline server secrets не используются. GitHub Environment `test` (production-like технический стенд) должен хранить `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` и pinned `DEPLOY_KNOWN_HOSTS`; deploy user не должен быть root и получает sudo только на allowlisted `/usr/local/sbin/meal-deploy`.

Image job публикует BuildKit provenance и SBOM рядом с образом. `NODE_IMAGE` и `NGINX_IMAGE` в `Dockerfile` закреплены проверенными references с `@sha256:`; при плановом обновлении версии сначала получить новый digest из registry, проверить image build/runtime smoke и обновить tag вместе с digest. Итоговый admin image развёртывается только по digest.

Server helper обязан под lock проверить allowlist component/image/digest, сохранить предыдущий digest, выполнить pull/recreate, дождаться `/healthz`, проверить публичные root/deep-link и контролируемый JSON `401` от admin `auth/me`. При любой ошибке он восстанавливает предыдущий digest и повторяет smoke. Ручной rollback выполняется отдельным allowlisted helper; workflow не редактирует Compose/env на сервере и не выполняет destructive database actions.

### Подтверждение rollout 29 октября 2026

- Admin `0.0.125`, source `5f944b2`, прошла GitHub workflows `Admin checks` (`40867575748`) и `Admin image and deploy` (`40867740006`).
- `/srv/meal/deployment/verify.sh --component admin` завершился успешно; контейнер image ID `43e8bd3b0551` находился в состоянии `healthy`.
- Публичные `/`, `/auth` и `/admin/testing` возвращают SPA document; неавторизованный `/api/v1/admin/acceptance-tests` возвращает контролируемый JSON `401`.
- В новой вкладке password/session flow корректно потребовал обязательный TOTP для доступа к `/admin/testing`; TOTP не обходился и не сохранялся в evidence. Browser console на auth boundary не содержал ошибок или предупреждений.
- Целевой backend `0.0.151`, OpenAPI `0.0.61` и additive migration/schema `v31`; admin rollout миграции не запускает.

### Историческое подтверждение rollout 28 октября 2026

- Сначала переключена backward-compatible admin `0.0.114`, затем применена schema `v29` и развёрнут backend `0.0.128`.
- Публичный root и прямой `/auth` deep link отвечают `HTTP/2 200`; Nginx продолжает выдавать SPA через HTTPS.
- Парольный этап тестового администратора доходит до обязательного MFA и не создаёт административную сессию до второго фактора. Credentials и второй фактор передаются отдельно и в Git не сохраняются.
- В интерфейсе доступны все четыре варианта темы. `Зелёная · тёмная` сохраняется после reload без ошибок JavaScript console.
- Admin `0.0.117` развёрнут в immutable release `20261028-0757`: root и `/admin/queues/recipes` отвечают `200`, парольный вход доходит до обязательной MFA-границы, темы `coffee-light` / `nature-dark` переключаются без runtime-ошибок. SHA-256 архива: `345411771c3e988a05bbdfca116535d00a1ec45b0391a2c49a3e126d8dcea83f`.

Перед каждым переключением сохраните в журнале выпуска: source revision, версии root и design-system manifests, UTC-время, release path, SHA-256 архива, прежний target `current` и исходный smoke-status. Не записывайте credentials или ответы с персональными данными.

## Требования к release

- Чистый checkout согласованной revision.
- Node.js 24.19+ и npm 11, как указано в `package.json`.
- Согласованный backend OpenAPI snapshot; `contracts:check` должен пройти до сборки.
- Production build только в `real`-режиме. Development mocks и `/dev/scenarios` не должны попадать в release.
- `node scripts/check-production-artifact.mjs` должен подтвердить отсутствие mock worker, source maps и env-файлов.
- Backend readiness `200` до и после переключения.
- Свободное место минимум для нового и предыдущего immutable release.

В production build допустимы только имена `VITE_API_MODE=real` и `VITE_APP_VERSION=<manifest-version>`. `BACKEND_ORIGIN` нужен только локальному Vite dev/preview proxy и на сервере не встраивается в SPA. Адрес backend задаёт Nginx. Секретных client-side переменных быть не должно.

## Сборка и проверка artifact

Из чистого checkout:

```sh
npm ci
node scripts/check-backend-contract.mjs /path/to/meal_backend/contracts/openapi.json
VITE_API_MODE=real VITE_APP_VERSION="$(node -p "require('./package.json').version")" npm run check
VITE_API_MODE=real VITE_APP_VERSION="$(node -p "require('./package.json').version")" npm run build
npm audit --omit=dev --audit-level=high
```

До упаковки проверьте:

- `build/index.html`, hashed assets и `public/theme-init.js` существуют;
- в `build` нет source maps, test reports, `.env*`, credentials и mock-only route;
- версия совпадает в `package.json`, `package-lock.json`, README и последней записи `version-list.md`;
- `node scripts/check-browser-budget.mjs` проходит по этой же production-сборке.

Упакуйте только `build` и безопасный release manifest с revision/version/build time. Вычислите SHA-256 локального архива и сравните с SHA-256 загруженного файла на VPS. Несовпадение блокирует публикацию. Никогда не перезаписывайте существующий release directory.

## Nginx boundary

Site-конфигурация принадлежит `/etc/nginx/sites-available/meal-planner`. Существенная структура admin server должна оставаться такой:

```nginx
server {
    listen 443 ssl;
    server_name admin.abstract-usable-gazebo.ruweb.place;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        # Общие proxy headers/timeouts задаются server/site-конфигурацией.
    }

    location / {
        proxy_pass http://127.0.0.1:3002;
        # SPA fallback, cache policy и /healthz принадлежат admin container.
    }
}
```

Фактическая конфигурация также обязана сохранять TLS, security headers, upload/time limits и proxy headers из общей site-конфигурации. Перед reload выполните `nginx -t`; копирование сокращённого примера поверх рабочего site запрещено. `admin.meal.royalexander.online` добавляется только после DNS/ACME gate; до этого имени не должны появляться в активном `server_name` как будто сертификат уже существует.

## Публикация

Обычный admin release не меняет schema и не управляет backend. Если OpenAPI требует новую migration/backend, сначала выпускается совместимая admin, затем backend выполняет собственный backup/migration/rollout runbook, после чего admin перечитывает live contract. Частичный ответ с одной из обязательных осей — блокирующая contract error, а не legacy fallback.

1. GitHub workflow принимает только успешный `Admin checks` для актуального tip `main`; stale source SHA блокируется до image build и повторно до deploy.
2. Собрать и опубликовать image по commit tag, получить registry digest и передать на VPS только `<image@digest>` вместе с точным source SHA.
3. Deploy user вызывает только allowlisted `sudo /usr/local/sbin/meal-deploy admin <image@digest> <source-sha>`. Helper под общим lock сохраняет previous digest, pull/recreate выполняет только для `admin` и не редактирует БД/Nginx/secrets.
4. Дождаться container `/healthz`, backend readiness и публичного smoke. При любом обязательном FAIL helper возвращает previous digest и повторяет verify.
5. После success выполнить технический и ручной smoke ниже. Только затем release и server inventory считаются согласованными.

Legacy `/srv/meal/admin/current` не является traffic source и не переключается при container rollout. Исторический порядок schema v29/backend 0.0.128 остаётся evidence прошлого перехода, но не является текущей процедурой публикации.

## Post-deploy smoke

Техническая часть:

```sh
/srv/meal/deployment/verify.sh --component admin
nginx -t
docker compose --project-name meal-planner --env-file /srv/meal/deployment/images.env \
  -f /srv/meal/deployment/compose.production.yml ps admin
curl --fail --silent http://127.0.0.1:3002/healthz
curl --fail --silent https://abstract-usable-gazebo.ruweb.place/health/live
curl --fail --silent https://abstract-usable-gazebo.ruweb.place/health/ready
curl --fail --silent --output /dev/null https://admin.abstract-usable-gazebo.ruweb.place/
curl --fail --silent --output /dev/null https://admin.abstract-usable-gazebo.ruweb.place/auth
curl --fail --silent --output /dev/null https://admin.abstract-usable-gazebo.ruweb.place/admin/testing
curl --silent --output /dev/null --write-out '%{http_code}\n' \
  https://admin.abstract-usable-gazebo.ruweb.place/api/v1/admin/acceptance-tests
journalctl -u nginx --since "15 minutes ago" -p err --no-pager
```

Неавторизованный admin API обязан вернуть контролируемый JSON `401`, а не `404`, `5xx`, HTML или upstream connection error. `/auth` и `/admin/testing` должны вернуть SPA document; приватный deep link затем переводит неавторизованного пользователя в auth-flow и сохраняет безопасный `returnTo`.

Ручная часть в чистом browser profile:

1. Открыть `/auth`, ввести переданные отдельно test credentials и убедиться, что парольный этап не даёт приватных данных до MFA.
2. Завершить обязательный TOTP либо разрешённый одноразовый recovery flow; открыть dashboard и перечитать один безопасный список.
3. Перезагрузить прямой private deep link и проверить route/session guard.
4. Переключить все четыре темы, перезагрузить страницу и убедиться в сохранении темы без вспышки другой палитры.
5. Проверить console/network: нет uncaught errors, mock requests, секретов, PII или source maps.
6. Выйти через UI, убедиться в недействительности staff session и очистке private/session-scoped cache. Закрыть профиль браузера; не сохранять пароль, TOTP seed, recovery code или cookie в evidence.

Полный набор сценариев находится в `ADMIN_TESTING.md`.

## Rollback

Rollback SPA не меняет БД, но предыдущий frontend обязан быть совместим с текущим backend API.

Если release менял только admin SPA, rollback возвращает предыдущий проверенный admin digest через allowlisted server helper и не трогает БД. Если contract checkpoint также включал backend/schema, сначала остановите writes и выполните совместимый backend rollback/forward-fix по его runbook; возврат admin раньше backend запрещён.

1. Остановить новые admin mutations и записать request IDs, симптомы, current/previous digest из защищённого server inventory и source SHA.
2. Убедиться, что previous digest существует, совместим с текущим OpenAPI/schema и уже проходил health/smoke.
3. Выполнить предусмотренную host runbook allowlisted rollback-команду; не редактировать `images.env` вручную и не использовать legacy symlink.
4. Повторить `/healthz`, root/deep-link/API smoke, password → MFA → dashboard и logout.
5. Сохранить failed digest и ограниченные логи для анализа; не исправлять immutable image на месте.

Если проблема вызвана backend/schema, одного rollback SPA недостаточно: следуйте backend recovery plan и не выполняйте destructive DB rollback из этого runbook.

## Наблюдение и очистка

После выпуска контролируйте Nginx `4xx/5xx`, upstream failures, размер/retention журналов, срок TLS, свободное место и browser telemetry. UFW должен разрешать только OpenSSH и `Nginx Full`; Node/PostgreSQL ports не публикуются.

Тестовые мутации выполняйте только на заранее выделенных fixtures/run namespace. После smoke отзовите временные staff-роли и сессии, удалите только созданные этим прогоном записи либо восстановите согласованный baseline по backend runbook. Никогда не очищайте общие таблицы или release directories широким glob/непроверенным путём.

## Известные gates

- Юридические документы имеют статус `draft_blocked`; публичный коммерческий запуск запрещён.
- Admin `0.0.125`, backend `0.0.149`, OpenAPI `0.0.61` и schema `v30` развёрнуты; Docker verify, базовый cross-app smoke, обязательная MFA boundary, темы и новый `/admin/testing` подтверждены. Полная ручная матрица остаётся отдельной приёмкой по `ADMIN_TESTING.md` и server checklist.
- Payment, production email/push, AI, external storage и scanner не настроены и должны оставаться fail-closed.
- Off-host backup/RPO-RTO, external alert/log sink, capacity/soak и окно обновления/reboot ОС ещё не подтверждены.
- Пользовательский frontend root/app `0.0.40` / `0.0.149` работает в Docker-контейнере на том же Compose-стеке. Полный сквозной ручной сценарий создания и модерации рецепта всё ещё требует действующий второй фактор администратора.
- Custom origin `admin.meal.royalexander.online` остаётся pending DNS/ACME; до завершённого cutover технический origin продолжает обслуживать трафик без redirect.
