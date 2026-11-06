# ADR 0001: исполняемые границы admin-архитектуры

- Статус: принято
- Дата: 04.11.2026
- Область: `meal_admin`

## Контекст

Админка использует pragmatic domain-first FSD, но прежний gate сочетал базовое направление слоёв с точечными regex для известных путей. Он не доказывал public API каждого активного slice, циклы, новые same-layer зависимости, aliases и рост literal query-key debt.

## Решение

`scripts/check-architecture.mjs` разбирает TypeScript/JavaScript через TypeScript AST и строит граф относительных static import/export и dynamic import со строковым литералом.

Обязательные правила:

1. Направление зависимостей: `app -> widgets -> features -> entities -> shared`.
2. Новые feature-to-feature и entity-to-entity зависимости запрещены.
3. Внешний потребитель slice использует только его объявленный public entrypoint.
4. Активные `features` и `widgets` имеют `client.ts(x)`, `entities` и `shared` — `index.ts(x)`, кроме перечисленных ниже явных вариантов.
5. Новый `export *` в public entrypoint запрещён.
6. Относительные source-циклы запрещены.
7. Mocks доступны production-коду только из DEV app composition roots и сами не импортируют app/widgets/features.
8. Bare import разрешён только для зависимости из `package.json`; path aliases, `baseUrl`, `compilerOptions.paths` и Vite aliases запрещены, пока gate не умеет их однозначно разрешать.
9. Computed dynamic import запрещён: его зависимость невозможно доказать статически.
10. Legacy roots и удалённые compatibility barrels не могут быть созданы снова.
11. Новые literal private query/cache keys запрещены; ключи должны принадлежать entity factory.

## Явные public API варианты

- `features/auth`: `client.ts` и ограниченный `access-client.ts`.
- `entities/staff-session`: `client.ts`, поскольку публичный контракт одновременно предоставляет query hook.
- `entities/admin-notification`: основной `index.ts`, специализированные contract entrypoints
  `preferences.ts`/`center-contracts.ts` и tree-shakeable query-key entrypoints
  `preferences-query-keys.ts`/`center-query-keys.ts`. Страницы импортируют только нужный контракт и фабрику ключей,
  поэтому настройки не загружают center schemas, а центр не зависит от feature compatibility barrels.
- `shared/api`, `shared/auth`, `shared/runtime`, `shared/storage`, `shared/telemetry`, `shared/ui`: текущие явно перечисленные multi-entry modules. Они не считаются разрешением добавлять новые точки входа без изменения policy и ADR.
- `app` — composition root, `mocks` — временно плоский test adapter layer; public entrypoint к ним не требуется.
- Корневой `main.tsx` — bootstrap вне FSD-слоёв.

## Debt ratchets

Gate разрешает только зафиксированный текущий долг; уменьшение проходит автоматически, увеличение блокирует check:

- 0 feature-to-feature edges. Checkpoint 5E перенёс admin status query capability и critical confirmation component в
  специализированные public entrypoints `shared/auth/admin-status.ts` и `shared/auth/critical-confirmation.tsx`.
  Одиннадцать feature consumers и auth screens используют downward-safe owners напрямую; `features/auth/access-client.ts`
  временно сохраняет только named compatibility re-exports с той же runtime identity и не имеет production consumers.
- 0 entity-to-`admin-section` edges. Checkpoint 5D1 заменил navigation-derived `BillingSection`/`GovernanceSection`
  точными локальными endpoint unions. Checkpoint 5D2 вывел `AdminRecordSection` из generated generic search contract,
  а feature composition явно отсекает единственный navigation-only раздел `releases`. Двусторонние compile-time
  parity checks связывают bounded types с generated params/success и доказывают `Section = AdminRecordSection |
'releases'` без runtime-зависимости entity от navigation.
- 0 notification compatibility imports: Checkpoint 5A удалил feature barrels и объявил два точных entity contract
  entrypoint публичными; остальные private imports по-прежнему запрещены.
- 0 mock strongly-connected components. Checkpoint 5B вынес `AdminRow` schema/type в нейтральный `mocks/admin-row.ts`,
  сохранив compatibility exports `admin-model`, и ограничил allergen handler структурным состоянием
  `{ allergens: AllergensState }`; runtime mock shapes и mutations не изменены.
- 0 `export *`. Checkpoint 5A заменил два wildcard re-export
  `admin-notification/index.ts` исчерпывающими named value/type exports, сохранив прежние имена index API.
  Checkpoint 5C1 тем же способом устранил по одному wildcard из `operation/index.ts` и `news/index.ts`; runtime schema
  identity, все type exports и query-key exports сохранены. Checkpoint 5C2 устранил оба wildcard из
  `content-workflow/index.ts`, сохранив identity всех schema/helper/query-key values и полный type API. Checkpoint 5C3
  устранил последний wildcard из `content-release/index.ts`, сохранив contracts/model/query-key identity и полный type API.
- 0 literal query/cache-key occurrences в production source. Два notification occurrence удалены в Checkpoint 4A:
  tuple-совместимые preferences и center factories теперь принадлежат специализированным публичным API
  `entities/admin-notification`, сохраняют principal scope и не создают общий lazy chunk.
  Ещё два operations occurrence удалены в Checkpoint 4B: exact workspace/root keys принадлежат публичному API
  `entities/operation`, сохраняют principal scope и прежнюю broad invalidation после успешного execute.
  Ещё два news occurrence удалены в Checkpoint 4C: единый exact workspace key принадлежит публичному API
  `entities/news` и одинаково используется query и command-result cache write.
  Ещё одно release occurrence удалено в Checkpoint 4D: session-global exact workspace key принадлежит публичному API
  `entities/content-release` и одинаково используется query и пятью command-result cache writes.
  Ещё два runtime-settings occurrence удалены в Checkpoint 4E: principal-scoped registry key и broad root
  invalidation принадлежат private factory одноимённого feature без преждевременного entity/public API.
  Ещё одно recipe-policy occurrence удалено в Checkpoint 4F: exact principal-scoped key принадлежит private
  factory `features/settings`, сохраняя explicit refetch после save без преждевременного entity/public API.
  Ещё пять allergen occurrence удалены в Checkpoint 4G: session-global list/detail/subject tuples и broad list
  invalidation принадлежат private factory `features/allergens` без изменения principal scope или нового entity.
  Последние шесть auth/session occurrence удалены в Checkpoint 4H: downward-safe exact identities принадлежат
  специализированному public entrypoint `shared/auth/query-keys.ts`; прежние entity/feature exports сохранены aliases.

Исключения адресуются точными source/target путями либо точным fingerprint и лимитом. Новый файл, путь, fingerprint или дополнительное occurrence не наследует исключение.

## Ограничения

- Циклы определяются только между локальными source-файлами; внутренний граф npm packages не анализируется.
- Dynamic import проверяется только со строковым литералом; вычисляемые пути запрещены.
- Query-key проверка намеренно узкая: line-local `queryKey: [...]`, прямой cache-call с literal array и `*Key = [...]`. Семантический data-flow не выводится. При появлении другого синтаксиса правило сначала расширяется вместе с regression fixture.
- CSS и другие относительные ресурсы участвуют в slice boundary по пути, но не входят в TypeScript cycle graph.
- Generated API, tests и mocks исключены из query-key debt; generated source не должен редактироваться вручную.

## Проверка

`test/architecture-gate.test.ts` создаёт изолированные fixtures только внутри `QA_OUTPUT_DIR` и доказывает принятие корректного графа и отклонение cross-layer, cross-slice, private import, missing public API, export-star, cycle, alias, computed dynamic import, literal query key и legacy root.

Любое изменение policy требует обновления этого ADR, focused fixtures и полного `npm run check`.
