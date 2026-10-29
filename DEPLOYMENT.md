# Deployment Meal Admin

Актуально на 28 октября 2026 года. Документ описывает тестовый production-стенд и воспроизводимый выпуск самостоятельной административной SPA. Он не содержит пароль администратора, TOTP secret, recovery-коды, cookies, root-доступ, строки подключения или содержимое env-файлов.

## Адрес и подтверждённый release

| Параметр         | Значение                                                  |
| ---------------- | --------------------------------------------------------- |
| Публичный origin | `https://admin.abstract-usable-gazebo.ruweb.place`        |
| Активный release | `/srv/meal/admin/releases/20261028-0757-0.0.117`          |
| Live-версия      | `0.0.117`                                                 |
| Репозиторий      | `0.0.119` (container delivery; live SPA — `0.0.117`)      |
| Contract/schema  | OpenAPI `0.0.60`, backend `0.0.128`, schema `v29`         |
| Точка выдачи     | `/srv/meal/admin/current/build`                           |
| API              | same-origin `/api`, proxy на `http://127.0.0.1:3001`      |
| Liveness         | `https://abstract-usable-gazebo.ruweb.place/health/live`  |
| Readiness        | `https://abstract-usable-gazebo.ruweb.place/health/ready` |

`/srv/meal/admin/current` — symlink на неизменяемый release directory. Админка не имеет собственного systemd-процесса: статический `build` выдаёт Nginx. Backend, PostgreSQL, TLS и общая сетевая граница описаны в `meal_backend/docs/DEPLOYMENT.md`.

Это описание подтверждённого live-состояния до контейнерного rollout. Версия `0.0.119` добавляет новый delivery path, но сама по себе не меняет текущий стенд: до отдельного согласованного deploy symlink release остаётся источником live SPA.

## Контейнерный delivery path

`Dockerfile` собирает real-only SPA на Node.js из `.node-version`, проверяет manifest version, production artifact и browser budget, затем переносит только `build` в unprivileged Nginx. Runtime слушает только внутренний `8080`; `/healthz` возвращает container liveness. Development `mockServiceWorker.js`, source maps и env-файлы блокируются artifact gate.

Контейнер не проксирует API. Его `/api` и `/api/` намеренно отвечают `404`, чтобы ошибочная gateway-маршрутизация не вернула SPA HTML вместо API-ответа. Host Nginx завершает TLS и для admin origin обязан направлять `/api/` напрямую в backend, а остальные пути — в admin container. В Compose порт `8080` только `expose`, без host publish; runtime запускается с `read_only: true`, tmpfs `/tmp`, `cap_drop: [ALL]` и `no-new-privileges`.

`.github/workflows/deploy.yml` запускается только после успешного `Admin checks` для push в `main`. Он checkout-ит проверенный `head_sha`, перед build и повторно перед deploy fail-closed сверяет его с актуальным tip `refs/heads/main`, публикует в GHCR только commit tag `sha-<full-sha>`, а deploy передаёт защищённому server helper только image reference с registry digest и source SHA. Mutable `latest` и semver tags, парольный SSH и inline server secrets не используются. GitHub Environment `test` (production-like технический стенд) должен хранить `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` и pinned `DEPLOY_KNOWN_HOSTS`; deploy user не должен быть root и получает sudo только на allowlisted `/usr/local/sbin/meal-deploy`.

Image job публикует BuildKit provenance и SBOM рядом с образом. `NODE_IMAGE` и `NGINX_IMAGE` в `Dockerfile` закреплены проверенными references с `@sha256:`; при плановом обновлении версии сначала получить новый digest из registry, проверить image build/runtime smoke и обновить tag вместе с digest. Итоговый admin image развёртывается только по digest.

Server helper обязан под lock проверить allowlist component/image/digest, сохранить предыдущий digest, выполнить pull/recreate, дождаться `/healthz`, проверить публичные root/deep-link и контролируемый JSON `401` от admin `auth/me`. При любой ошибке он восстанавливает предыдущий digest и повторяет smoke. Ручной rollback выполняется отдельным allowlisted helper; workflow не редактирует Compose/env на сервере и не выполняет destructive database actions.

### Подтверждение rollout 28 октября 2026

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
    root /srv/meal/admin/current/build;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        # Общие proxy headers/timeouts задаются server/site-конфигурацией.
    }

    location = /index.html {
        add_header Cache-Control "no-store" always;
        try_files $uri =404;
    }

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

Фактическая конфигурация также обязана сохранять TLS, security headers, upload/time limits и proxy headers из общей site-конфигурации. Перед reload выполните `nginx -t`; копирование сокращённого примера поверх рабочего site запрещено.

## Публикация

Для перехода на schema v29/backend 0.0.128 порядок обязателен: сначала совместимая admin 0.0.114, затем migration/backend. Перед backend-switch остановите новые moderation writes, дождитесь исхода незавершённых команд и закройте либо hard-reload все вкладки со старой admin 0.0.113; смешанные версии backend pods запрещены. До переключения backend откройте legacy moderation case и убедитесь, что admin читает `current/pending`, а moderation request не содержит `publicReason`. После backend-switch выполните hard reload, перечитайте case: raw response обязан содержать обе оси `review/publication`, и только после этого admin отправляет `publicReason`. Частичный ответ с одной осью — блокирующая contract error, а не legacy fallback. Возобновляйте writes только после этого smoke.

1. Зафиксировать текущий target: `readlink -f /srv/meal/admin/current`.
2. Проверить `nginx -t`, backend `/health/live` и `/health/ready`, свободное место и ошибки Nginx за последние 15 минут.
3. Создать новый `/srv/meal/admin/releases/<release-id>` и распаковать проверенный artifact. Убедиться, что абсолютный путь находится внутри `/srv/meal/admin/releases`.
4. Выставить владельца/права так, чтобы Nginx мог только читать release. Не хранить `.env`, архив или checksum рядом с публичным `build`.
5. До переключения проверить наличие `build/index.html`, ожидаемой версии и hashed assets; не изменять файлы release на месте.
6. Создать новый временный symlink рядом с `current`, проверить его target и атомарно заменить `current` через rename. Не удалять прежний release.
7. Выполнить `nginx -t` и reload Nginx только если site-конфигурация менялась. Для обычной смены symlink reload не требуется.
8. Выполнить технический и ручной smoke ниже. Только после него release считается активным.

## Post-deploy smoke

Техническая часть:

```sh
test "$(readlink -f /srv/meal/admin/current)" = "/srv/meal/admin/releases/<release-id>"
test -f /srv/meal/admin/current/build/index.html
nginx -t
curl --fail --silent https://abstract-usable-gazebo.ruweb.place/health/live
curl --fail --silent https://abstract-usable-gazebo.ruweb.place/health/ready
curl --fail --silent --output /dev/null https://admin.abstract-usable-gazebo.ruweb.place/
curl --fail --silent --output /dev/null https://admin.abstract-usable-gazebo.ruweb.place/auth
curl --fail --silent --output /dev/null https://admin.abstract-usable-gazebo.ruweb.place/admin/news
curl --silent --output /dev/null --write-out '%{http_code}\n' \
  https://admin.abstract-usable-gazebo.ruweb.place/api/v1/admin/auth/me
journalctl -u nginx --since "15 minutes ago" -p err --no-pager
```

Неавторизованный `auth/me` обязан вернуть контролируемый `401`, а не `404`, `5xx`, HTML или upstream connection error. `/auth` и `/admin/news` должны вернуть SPA document; приватный deep link затем переводит неавторизованного пользователя в auth-flow и сохраняет безопасный `returnTo`.

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

Для этого contract checkpoint rollback выполняется в обратном порядке: сначала остановить moderation writes и вернуть backend к совместимой legacy-версии по его runbook, затем при необходимости admin SPA. Сразу после backend rollback все вкладки обязаны выполнить hard reload или новую служебную сессию, чтобы сбросить capability; вкладка, уже увидевшая новый backend, до reload безопасно получит `400` от legacy strict request, но не должна использоваться для writes. Admin 0.0.114 умеет работать с обоими контрактами после нового read, а admin 0.0.113 и старше нельзя возвращать поверх backend, который уже требует оси `review/publication`.

1. Остановить публикацию и записать request IDs, симптомы и текущий release target.
2. Проверить, что предыдущий immutable release существует, содержит `build/index.html` и совместим с текущим OpenAPI.
3. Создать проверенный временный symlink на предыдущий release и атомарно заменить `current`.
4. Повторить root/deep-link/API smoke, password → MFA → dashboard и logout.
5. Сохранить failed artifact и логи для анализа; не исправлять release на месте.

Если проблема вызвана backend/schema, одного rollback SPA недостаточно: следуйте backend recovery plan и не выполняйте destructive DB rollback из этого runbook.

## Наблюдение и очистка

После выпуска контролируйте Nginx `4xx/5xx`, upstream failures, размер/retention журналов, срок TLS, свободное место и browser telemetry. UFW должен разрешать только OpenSSH и `Nginx Full`; Node/PostgreSQL ports не публикуются.

Тестовые мутации выполняйте только на заранее выделенных fixtures/run namespace. После smoke отзовите временные staff-роли и сессии, удалите только созданные этим прогоном записи либо восстановите согласованный baseline по backend runbook. Никогда не очищайте общие таблицы или release directories широким glob/непроверенным путём.

## Известные gates

- Юридические документы имеют статус `draft_blocked`; публичный коммерческий запуск запрещён.
- Revision-aware admin `0.0.117`, backend `0.0.128` и schema `v29` развёрнуты; базовый cross-app smoke, password → MFA boundary и темы подтверждены. Полная ручная матрица модерации остаётся отдельной приёмкой по `ADMIN_TESTING.md`.
- Payment, production email/push, AI, external storage и scanner не настроены и должны оставаться fail-closed.
- Off-host backup/RPO-RTO, external alert/log sink, capacity/soak и окно обновления/reboot ОС ещё не подтверждены.
- Пользовательский frontend переключён на root/app `0.0.28` / `0.0.137` в release `/srv/meal/frontend/releases/20261028-0735-0.0.28-0.0.137`; read-only desktop/mobile acceptance прошёл `24/24` без mutation requests и runtime errors. Полный сквозной ручной сценарий создания и модерации рецепта всё ещё требует действующий второй фактор администратора.
