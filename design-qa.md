# Design QA — acceptance testing option 2

final result: passed

## Evidence

- Source visual truth: `D:\Agents\EP Frontend projects\projects\tempFiles\meal-admin-test-checklist-design\selected-option-2.png`.
- Source pixels: `1487×1058`, `96×96 dpi`.
- Implementation: `http://127.0.0.1:5199/admin/testing`, authenticated mock administrator, `nature-dark`.
- Implementation screenshot evidence: Codex in-app browser tab 17, inline capture from 29.10.2026; the IAB provider does not expose a stable filesystem path.
- Desktop CSS viewport: `1440×1024`, device density `1`; captured content pixels: `1430×1017`.
- Mobile CSS viewport: `390×844`, device density `1`; captured content pixels: `380×822`.
- State: four catalog groups, one selected case, reset result with preserved comment/history metadata, desktop footer fixed inside the case workspace.

## Full-view comparison evidence

The selected source and the final IAB desktop capture were reviewed together at the same desktop state and normalized to their content frames. The implementation preserves the source hierarchy: page heading and progress, two-column catalog/detail workspace, search and status filter, grouped cases, source/steps/expected result, four result choices, comment, audit metadata and bottom actions.

The real `ServiceShell` remains intentionally different from the generated mock shell: it keeps the product's existing text navigation and theme control in the sidebar. Replacing the shared shell only for this page would create an inconsistent application-wide navigation model. This is an accepted product constraint, not unresolved design drift.

Focused regions reviewed:

- catalog toolbar, group headers, selected row and semantic status labels;
- case title, source, numbered steps and expected-result hierarchy;
- four status cards, comment counter and reset audit wording;
- sticky desktop footer with previous/save/save-and-next actions;
- mobile header, search/filter stack and case-list overflow at `390×844`.

## Required fidelity surfaces

- Fonts and typography: existing design-system serif display headings and sans UI copy match the chosen visual hierarchy; weights, wrapping and truncation remain readable at desktop and mobile sizes.
- Spacing and layout rhythm: the desktop proportions match the two-pane source; bounded catalog/detail scrolling prevents long cases from hiding persistent actions. Mobile collapses to one column without horizontal overflow.
- Colors and tokens: all four themes use shared semantic tokens. Verified body colors were distinct for `coffee-light`, `coffee-dark`, `nature-light` and `nature-dark`; no feature-local color literals were added.
- Image and icon fidelity: the screen contains no custom raster illustration. Existing Meal Planner branding and design-system `AppIcon` assets are used; there are no placeholder images, handcrafted SVGs, CSS drawings or emoji substitutes.
- Copy and content: labels and actions match the selected Russian mock. Actual case titles and counts come from the authoritative 83-case backend catalog rather than the four demo rows shown in the visual concept.

## Interaction and runtime checks

- Password + TOTP mock login and new-tab unlock.
- Search automatically presents the first visible matching case.
- Status selection, bounded comment, save-and-next, confirmed progress update, reload persistence and reset.
- Reset keeps the comment/history and changes the audit label to `Вернул на проверку`.
- All four themes applied; `coffee-light` persisted across reload.
- Group disclosure, status filter controls and keyboard-native radios/buttons were present in the accessibility tree.
- Mobile `390×844`: `documentWidth=380`, `bodyWidth=380`, `innerWidth=390`; no horizontal overflow.
- Fresh final IAB tab console: no warnings or errors.
- `npm run check`: design system `5/5`, application `123/123`, contracts, architecture, TypeScript, ESLint, Prettier and Stylelint passed.
- Production build: 309 modules; production artifact gate passed.

## Comparison history

1. Initial desktop capture showed the detail actions below the visible viewport for longer content. The detail workspace received bounded internal scrolling and a sticky footer; the revised `1440×1024` capture keeps all primary actions visible.
2. Search initially narrowed the catalog while leaving a previously selected hidden case in the detail pane. Selection is now derived from the visible result set without an effect-driven render loop; searching for `MFA` immediately presents the Backend/API case.
3. Reset initially retained the generic `Проверил` audit label. The final UI uses `Вернул на проверку` for a reset result while preserving the actor, timestamp and comment history.
4. A clean new IAB tab was unlocked and reloaded after the fixes. The final console was empty and the screen rendered without clipping, overlap or runtime errors.

## Residual P3 notes

- Very long real cases require scrolling inside the detail card by design; the sticky action footer remains available.
- The selected mock shows decorative sidebar icons for every navigation item, while the existing production shell deliberately uses text navigation. No page-local shell fork was introduced.

## Previous passed review

The observability option 1 review was completed earlier with `final result: passed`. Its runtime coverage remains documented in `ADMIN_TESTING.md` and `TESTs.md`; this file now records the latest Product Design handoff.
