# ADR 0002: типизированный manifest route metadata

- Статус: принято
- Дата: 04.11.2026
- Область: `meal_admin`, Checkpoint 3A

## Контекст

До 3A JSX route tree, lazy bindings, title map и интерпретация admin section находились рядом в `app.tsx`, но не имели единой типизированной модели. `entities/admin-section` отдельно и корректно владеет доменными разделами, `sectionPath`, `detailPath` и `activeSectionForPath`; перенос этих функций в `app` создал бы запрещённую зависимость feature/widget/entity -> app.

## Решение

`src/app/routes/manifest.ts` содержит 28 route definitions в том же порядке, что JSX tree:

- 2 pathless layout nodes;
- 22 guarded screen/redirect nodes;
- 1 guarded `mock-dev` node;
- 2 unguarded auth screens;
- 1 wildcard fallback;
- index routes отсутствуют.

Каждая запись типизирует стабильные metadata: `path`, binding, structural access, title, fixed/parameter admin section, detail, redirect, conditional и lazy marker.

`access` означает только фактическую структуру текущего Router:

- `admin-session` — node вложен в `SessionGuard context="admin"`;
- `unguarded` — node расположен вне guard.

Поле не утверждает anonymous-only, role или grant policy и не меняет backend authorization.

`RouteMetadata` использует `resolveRoutePresentation`. Resolver сохраняет точное прежнее поведение, включая exact static titles, `moderation -> queues`, особое недетальное `/admin/queues/recipes`, неизвестные sections и trailing-slash edge cases. Focus/scroll transition не переносился и не менялся.

## Граница с admin-section entity

`entities/admin-section` остаётся владельцем доменной модели и navigation helpers. App manifest импортирует entity public API; обратный импорт запрещён. Widget и feature consumers продолжают использовать entity helpers, потому что импорт app manifest нарушил бы направление слоёв.

В 3A JSX `<Route>` tree, lazy imports, loaders, redirect element и conditional rendering намеренно не генерируются из manifest. Это исключает изменение runtime-композиции. `test/app-route-manifest.test.ts` через TypeScript AST доказывает одинаковые count/order/path/binding и отдельно проверяет parity с `sectionPath`, `detailPath` и `activeSectionForPath`.

Переход к generated route tree возможен только отдельным checkpoint после browser parity; он не является частью 3A.

## Проверка

Focused tests фиксируют:

- ровно 28 route nodes и отсутствие index routes;
- path/order/binding parity с `app.tsx`;
- redirect `/admin/queues -> /admin/queues/recipes`;
- guarded mock-only route;
- lazy bindings;
- structural access split 25/3;
- прежние title и edge semantics;
- canonical list/detail paths всех admin sections;
- неизменный focus/scroll transition.
