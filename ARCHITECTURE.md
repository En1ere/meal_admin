# Meal Admin architecture

Meal Admin развивается как FSD-подобное приложение, но границы определяются административными процессами. Backend остаётся владельцем staff roles/grants, MFA, audit и wire-контрактов.

## Слои

- `app` — router, route metadata, lazy chunks и композиция providers.
- `widgets` — admin shell, session guard и междоменная композиция экранов.
- `features` — законченные действия сотрудника: вход/MFA, moderation decision, support reply, grant/revoke, publish/rollback.
- `entities` — staff session, admin record, support ticket, access, billing, content workflow, catalog, content release, news, admin notification и operation models/query keys.
- `shared` — API transport, runtime, request cancellation, design-system adapters, theme и технические utilities.

Зависимости направлены только вниз. `app` и соседние домены должны использовать явные `client.ts` public APIs. CSS Module принадлежит своему домену. Глобальный CSS содержит только reset, typography и общие accessibility/layout primitives.

## Доменные контексты

1. `staff-identity`: `/`, `/auth`, `/auth/mfa`, session, unlock, logout, critical confirmation.
2. `overview`: `/admin`.
3. `content-workflow`: moderation на `/admin/queues/**`, `/admin/moderation/:id` и catalog compare/merge на `/admin/catalog/:id`; контракты и session-scoped query keys принадлежат одной entity, UI доступен только через feature client API.
4. `support`: `/admin/support/**`.
5. `user-governance`: users, sanctions, access и Free AI grants.
6. `billing`: subscription и payment commands. Семейные записи пока остаются generic admin-record: billing API принимает только `users | subscriptions | payments`, поэтому family commands нельзя добавлять без отдельного backend-контракта.
7. `catalog`: `/admin/catalog/**` и allergens; compare/merge commands принадлежат `content-workflow`.
8. `content-releases`: releases, achievements, reputation и atomic publication.
9. `communications`: news.
10. `compliance`: audit, rollback и legal/account-deletion requests.
11. `operations`: jobs, errors и metrics.
12. `notifications`, `recipe-governance` и mock-only `dev-scenarios`.

## Неподвижные контракты

Без отдельного согласования нельзя менять URL, generic admin endpoint/section wire codes, OpenAPI schemas, staff auth/MFA/unlock proof, optimistic version, preview/idempotency keys и последовательность permission → re-auth/MFA → preview → confirm → execute → audit/readback. Provider operations остаются fail-closed.

Private query keys должны включать principal/session identity и принадлежать entity. Theme остаётся unscoped. Exact retry замораживает payload и idempotency key; доменные preview/confirmation/readback не выносятся в универсальный command.
Проверка critical confirmation выполняется до idempotency replay. `403` во время точного повтора сначала перечитывает auth status: истёкшее confirmation сохраняет frozen attempt и требует повторного TOTP/recovery, а активное confirmation означает запрет роли/разрешения и не должно предлагать бесполезный TOTP. Protected `401` может сбросить private runtime и размонтировать экран; frozen command не считается пережившим такой переход, поэтому после auth recovery обязательны readback и ручная проверка исхода перед новым действием.

## Миграция

1. Architecture gate и technical shared runtime/theme/request primitives.
2. Staff session entity, auth public API и session-guard widget.
3. Admin-shell widget и route-level composition.
4. Generic admin-record entity с canonical query keys и typed wire adapters.
5. Support; user governance; billing.
6. Moderation; compliance; operations.
7. Catalog; content releases; news; notifications; recipe policy.
8. Mock adapters ниже UI, локализация feature CSS и удаление debt allowlists — завершено: общие контракты content release, news, admin notification и operations принадлежат entities; mock-to-feature allowlist удалён и gate допускает ноль таких зависимостей. Совместимые feature re-export сохраняют внутренние импорты без изменения runtime и публичных контрактов.

Каждый checkpoint завершается contracts, architecture, typecheck/lint/style, unit, production build и целевым E2E. Публичные API и backend payload не меняются внутри архитектурного checkpoint.
