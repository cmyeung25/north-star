This document summarizes the current system architecture, data flow and code organisation of the Aurin / North‑Star financial planning SaaS. It is intended as a reference for Codex agents when making changes: it emphasises strict isolation boundaries, routing conventions and the responsibilities of each layer so that PRs do not accidentally break the core engine or data integrity.

⚠️ Always remember the core principles:

Minimal change / no engine modifications. The projection engine is the heart of the platform. Do not alter its algorithms or interfaces without a full regression plan.

No scenario leakage. Cases, scenarios and Plan Lab sandboxes are isolated containers; changes in one must not affect another.

Stable routing & auth. The user flow is strictly defined: login always lands in the member area, and only then can a scenario be opened.

Consistency in theming and casing. All pages must be wrapped by the same MantineProvider + aurinTheme. File and folder names are case‑sensitive on Vercel (Linux); avoid upper/lower case duplicates.

1 Domain model

The domain layer (packages/domain) defines the canonical types used throughout the system. Everything revolves around time‑series cashflow projections. Core entities:

User

Represents an authenticated member account. Authentication currently relies on Supabase (and possibly NextAuth). A user can own many Cases.

Case

A container for related financial plans (scenarios). Each case groups one or more scenarios under a common life theme (e.g. “buy a flat”, “raise a child”).

Only exists in the member area: users can create, rename, delete and enter cases. The case stores metadata (title, timestamps, maybe currency) and references to scenarios.

Scenario

A concrete plan within a case. A scenario contains baseline events (income, expenses, assets, liabilities) and derived adjustment events.

Scenarios are isolated: editing one must not mutate another. When entering a scenario, its baseline is loaded into the UI; any modifications (via Plan Lab or Money pages) create patches or new events that remain scoped to that scenario.

Scenarios have meta information such as onboarded to indicate whether onboarding is complete. Data hydration is done via ScenarioHydrator which merges baseline data with stored patches.

Onboarding

The initial setup flow for a scenario. It collects basic financial information (salary, rent, assets, loans, etc.) and produces baseline events via the compiler.

After onboarding, users should land directly on the dashboard/Plan Lab; re‑entering onboarding for a completed scenario is a sign of inconsistent meta.onboarded flags (see DB consistency notes below).

Plan Lab (sandbox)

An experiment space to try patches/what‑if adjustments without committing them to the baseline. Users can test different assumptions (e.g. “move house next year”) and compare projections.

Never pollute the baseline: patches created in Plan Lab must be stored separately and only applied when the user explicitly saves them as a new scenario or applies them back.

Events and adjustments

All financial data is eventually represented as events—income, expense, asset purchase, liability, investment, etc.—with start/end months, cadence, amount and other attributes. These events form the input for the projection engine.

Adjustments are special events that modify a base event (e.g. salary raise, rent increase). The preferred creation function is onCreateEventAdjustment, which accepts a baseEvent and a spec (delta or override, effective month range) and produces a domain patch/DTO. This generic mechanism is used both for income and expense events, replacing older salary‑only adjustment methods.

2 Repository structure
2.1 Turborepo and packages

packages/domain/ – Defines domain types, entities and invariants. Contains event types (income, expense, adjustment), scenario metadata, case definitions, etc.

packages/adapters/ – Maps UI form values to DTOs and domain types, and vice versa. Contains form schemas (e.g. for onboarding pages) and data mappers.

packages/compiler/ – Transforms DTOs or onboarding drafts into domain events and patches. Ensures that domain invariants are respected.

packages/engine/ – The projection engine. Consumes domain events and outputs monthly cashflow series, net‑worth charts and KPIs. Do not change formulas or interface without tests and backwards compatibility plan.

packages/db-migrations/ – Contains migration files for the database schema. The latest migration defines tables such as users, cases, scenarios, events, event_adjustments, possibly planlab_snapshots, and indexes for efficient queries. Each migration must increment a schema version and preserve existing data.

2.2 apps/web/ – Next.js App Router front‑end

The UI is a single Next.js application with route groups for different areas. The directory structure under apps/web/app/ uses Next.js route segments
 and layouts
 to group pages.

Key folders:

_providers/ – Root providers (Mantine, Supabase auth, contexts). All pages must be wrapped in MantineProvider using theme/aurinTheme.ts to ensure consistent styling.

(marketing)/ – Public marketing pages (/{locale}/web). Shows platform value, features and CTAs. Must use the same theme; avoid inline HTML styling.

(auth)/ – Login and registration pages (/{locale}/auth/login, /{locale}/auth/register). Handles session creation and redirection.

(member)/ – Member console (/{locale}/member/*). Contains case list and account settings. Users manage cases here. After login, always redirect to /{locale}/member/cases.

(app)/ – Scenario app (/{locale}/app/*). Contains Dashboard, Money, Plan Lab, Scenario Settings and Onboarding pages. The app layout includes a left navigation bar (fixed), a top bar with “Back to Cases” and “Save” actions, and the main content.

[locale]/ – Locale route prefix (e.g. zh-HK, en). All pages live under a locale; default is zh-HK. Actual source pages should exist only once to avoid duplication; locale routing is implemented via rewrites/middleware. Do not duplicate the same page under multiple locales – this will cause Vercel case‑sensitivity problems.

theme/aurinTheme.ts – Defines the design tokens (colours, spacing, radius, typography). Use these tokens via Mantine.

providers.tsx / app-providers.tsx – Wrap the app with MantineProvider, Auth provider and other context providers. Ensure every route uses this pipeline.

3 Data flow and key functions
3.1 UI → Adapters → Compiler → Domain → Engine → UI

The typical path of data is:

User input (forms in onboarding or Money/Plan Lab) collects values (amounts, start dates, cadences, etc.).

Adapters convert raw form data into DTOs. They perform basic validation and map UI fields to domain field names.

Compiler takes DTOs and constructs domain events and patches. For example, createEventAdjustmentPayload builds an adjustment event spec and wraps it as a patch. Salary adjustments were previously handled separately but are now unified under onCreateEventAdjustment.

Domain events and patches are stored in the database and passed to the engine. Each event includes metadata such as eventId, baseEventId (for adjustments), type (income, expense, adjustment), startMonth, endMonth, cadence, amount or delta. ScenarioHydrator merges baseline events with stored patches to produce a complete event list when a scenario is opened.

Engine consumes the list of domain events and projects them into monthly series and KPIs (cashflow, net worth, debt ratio, etc.). It outputs arrays of monthly amounts and summary statistics used to generate charts and dashboards.

UI uses engine output to render dashboards, charts and Plan Lab comparisons.

3.2 Adjustments

The unified adjustment creator is onCreateEventAdjustment(baseEvent, spec). It accepts any income or expense event and returns a domain patch representing the adjustment. Both Income and Expense event lists use this function for “新增調整” actions.

onCreateSalaryAdjustment is now a wrapper around onCreateEventAdjustment to maintain backwards compatibility; new code should call the generic version.

The adjustment spec includes effectiveMonth, delta or override, and optional endMonth. The compiler builds an adjustment event referencing baseEventId and stores it in the event_adjustments table.

3.3 Hydration & consistency issues

ScenarioHydrator reads both meta.onboarded at the root and individual scenarios[].meta.onboarded. There is a known inconsistency where root meta is false but scenario meta is true; PRs should investigate the hydrator and DB selectors when onboarding reappears unexpectedly.

State version fields (e.g. stateVersion, schemaVersion, onboardingVersion) should be incremented when data shapes change to maintain backward compatibility.

3.4 Change Boundaries

Forbidden changes (without explicit approval and full evidence):

- Do not modify projection engine algorithms or public interfaces in packages/engine unless the PR includes regression tests and a backward-compatibility note.
- Do not write data across scenario/case boundaries (no scenario leakage). Any write path must stay scoped to the active scenario and its parent case.
- Do not alter post-login redirect behavior away from /{locale}/member/cases.

Changes requiring explicit review details in PR:

- If ScenarioAssumptions, schema shape, or hydrator behavior changes, update schemaVersion/stateVersion/onboardingVersion where applicable.
- Document migration impact and/or selector/hydrator impact scope (which tables/selectors/hydrators and which routes/features are affected).

4 Database schema & migrations

While the exact schema is defined in packages/db-migrations, the high‑level structure includes:

Table	Purpose	Key columns
users	Authenticated users	id (PK), email, created_at, last_login_at, OAuth provider fields
cases	Cases owned by users	id, user_id (FK → users), title, created_at, updated_at
scenarios	Scenarios within cases	id, case_id (FK → cases), title, meta_onboarded, created_at, updated_at
events	Baseline events for scenarios	id, scenario_id (FK → scenarios), type (income/expense/asset/liability), start_month, end_month, cadence, amount, metadata
event_adjustments	Adjustment events referencing a base event	id, scenario_id, base_event_id, effective_month, delta, override, end_month
planlab_snapshots	Saved experiments from Plan Lab	id, scenario_id, snapshot_data, created_at

Migrations ensure indices (e.g. on user_id, case_id, scenario_id) and maintain referential integrity. Always list current migrations and table definitions before introducing a schema change.

5 Auth & session handling

Auth pages live under /{locale}/auth/. They handle registration and login via email/password or OAuth (Google/Facebook, some features may be “coming soon”).

On successful login, the server must redirect to /{locale}/member/cases (never directly to /{locale}/app). This ensures the user explicitly picks or creates a case before entering a scenario.

Session management is handled via Supabase (server‑side) and the AuthContext provider client‑side. Use hooks (e.g. useSession) to access the current user.

For locale‑aware redirection, the middleware reads the locale from the path or cookie (aurin_locale), and rewrites/redirects accordingly.

6 Routing best practices

Member vs. App separation

Member area (/{locale}/member/*): case management and account settings. Only lists cases or updates user profile. Member UI should be clean and simple.

App area (/{locale}/app/*): deep scenario editing, dashboards, Plan Lab and onboarding. Left nav is fixed; top bar shows case–scenario title and actions.

No direct deep linking from marketing or auth to the app. Always pass through the member area to pick a case.

Locale prefix always present. Actual pages should not be duplicated; use middleware rewrites to map /{locale}/… to a single underlying implementation.

Case‑sensitive paths. Use consistent lowercase folder names (marketing), [locale], etc. Do not accidentally commit both (Marketing) and (marketing); Vercel’s Linux file system will treat them as distinct.

Mantine providers. Wrap every route group with the existing providers pipeline to guarantee consistent theming and contexts. Do not embed additional MantineProviders inside child layouts.

7 UI considerations & design system

Use the Aurin Design System v0.1 defined in theme/aurinTheme.ts and Mantine components.

Marketing pages can use containers and marketing‑specific layouts (e.g. wide hero banners). Member and app pages should use fluid layouts without containers, giving dashboards full width.

Left navigation in the app should be dark (Polar Night Navy), fixed position, with subtle shadow. The active item uses a 2–3 px Aurora Green indicator. The “Back to Cases” link sits at the bottom.

Avoid blank screens during navigation. When entering a scenario, display an overlay (“正在打開『Case Name』”) and an AppShell skeleton until the engine data loads. Never show a white blank page.

Use skeleton loaders for dashboards (KPI cards, charts) rather than generic “Loading…” text.

7.1 UX/UI Consistency Checklist

- Copy & language: all new UI strings must use i18n keys; hardcoded user-facing strings are forbidden.
  驗收方式：檢查變更檔案中的字串是否來自翻譯 key（例如 useTranslation / message files），且無新增硬編碼文案。
- Field semantic consistency: percentage fields must indicate direction (e.g. growth/depreciation), and the same concept must not flip sign conventions across screens.
  驗收方式：在設定頁與相關表單檢查欄位 label + hint，確認可清楚區分方向與正負號規則。
- Information architecture consistency: global display settings (e.g. real/nominal) and scenario assumptions must be shown in separate sections, not mixed in one semantic layer.
  驗收方式：檢查頁面區塊與標題分組，確認「顯示設定」與「情境假設」為不同群組。
- Loading experience: white screens are forbidden; page-level transitions must show skeleton and/or overlay.
  驗收方式：手動切換主要頁面流程（member → app、app 子頁切換），確認全程有載入骨架或覆蓋層。
- Action feedback: save/apply defaults/reset actions must provide toast feedback or clear visual state.
  驗收方式：逐一觸發儲存、套用預設、重設，確認有 toast 或可辨識狀態回饋。

PR requirement:

- PR description must include a UX impact summary: which user flows changed, and whether existing mental models are affected.

8 Recent changes & key PR patterns

Unified adjustment pipeline – onCreateEventAdjustment now serves as the single mechanism for creating adjustments on both income and expense events. The older onCreateSalaryAdjustment function is kept as a wrapper. The Money module has been refactored so that expense lists call the same creator.

Member → App transition improvements – Avoid two blank screens by adding a loading overlay in the member area when opening a scenario and showing an AppShell skeleton in the app area until projection data loads.

Locale‑aware routing via middleware – The actual pages live outside [locale] but are accessed through /{locale}/… via rewrites. This prevents duplication and case‑sensitivity problems while preserving locale‑specific URLs.

Account hub consolidation – All account management features (profile, security, connected accounts, data export, billing) are now under /{locale}/member/account with a tabbed Mantine UI. The old account settings routes now redirect to the new hub.

Event taxonomy & mapping registry – Structural semantics are now centralized: `type` is reserved for structural event type (`cashflow/housing/loan/insurance/adjustment`), `kind` for structural sub-kind, and legacy business categories stay in `incomeSubtype`/`category`. Shared unions live in `apps/web/src/domain/events/eventTaxonomy.ts`, while legacy↔v2 conversion is consolidated in `apps/web/src/domain/events/eventMappingRegistry.ts` with fail-fast handling for unknown legacy types.

9 Checklist for PR authors

Before submitting changes, check:

Data flow – Did you only modify UI/adapters/compiler? If you touched engine, provide regression tests and backward compatibility.

Scenario isolation – Ensure no data leaks across scenarios or cases.

Routing – Does the new route follow the locale convention and proper group (marketing, auth, member, app)? Are there any case‑sensitive mismatches?

Providers & theme – Is every page wrapped by MantineProvider using aurinTheme? Avoid duplicate providers.

Auth rules – After login, redirect to /{locale}/member/cases only. Do not auto‑enter an app scenario.

Database consistency – If you changed schemas, list current tables and migrations. Update schemaVersion/stateVersion as necessary.

i18n – Any new UI text uses useTranslation with keys defined in message files. Do not hardcode strings.

Case‑sensitivity – Ensure new folders/files have consistent lower‑case names. Run pnpm -C apps/web build locally to catch Vercel‑only errors.

Loading behaviour – Provide skeletons or overlays for navigation transitions. Avoid blank pages.

Quality Gates (must run)

pnpm -w lint
pnpm -w typecheck
pnpm -w test
pnpm -w --filter web build

If any command cannot run, the PR must clearly state the reason, impacted scope, and alternative validation performed.

Architecture Delta Log (template)

- Date:
- Changed modules:
- Data-flow impact:
- Backward compatibility:
- Risk & rollback:

PR requirement:

- Agent final response must list each Quality Gate command with pass/fail/warn status.

Adhering to this architecture will ensure that Codex agents maintain a stable, predictable system while continuing to develop new features.

For those changes requested by user if needed to be saved to inform next Codex agents, please update this AGENTS.md document.

10 Agent Memory Update Protocol

When to update AGENTS.md (mandatory):

- Any task that adds/changes core routing rules, Provider chain, data-flow nodes, event taxonomy, or assumptions field semantics.
- Any fix for known inconsistencies (e.g. onboarding/meta/hydrator behavior mismatch).

Execution reminder for Codex:

- 若任務涉及 UX 流程、架構邊界、資料模型或路由，完成前先檢查是否需要更新 AGENTS.md；需要則一併提交。

Append-only policy:

- Maintain a section named `### Changelog for Future Agents`.
- New records must be appended only; never rewrite or delete historical records.

Record format (recommended):

- Context / Why
- What changed
- Affected paths
- Guardrails for next agent
- Validation commands run

PR requirement:

- PR body must reference the AGENTS.md entry added in this task so knowledge capture is not skipped.

### Changelog for Future Agents

- Date: 2026-03-03
  - Context / Why: Strengthen persistent guardrails for UX consistency, architecture boundaries, and agent memory updates.
  - What changed: Added section 3.4 Change Boundaries; added 7.1 UX/UI Consistency Checklist with acceptance criteria; added Quality Gates and Architecture Delta Log template; added section 10 Agent Memory Update Protocol and PR/body linkage requirements.
  - Affected paths: AGENTS.md
  - Guardrails for next agent: Run all four Quality Gates or document failure reason + impacted scope + fallback validation; append to this changelog for any future UX/architecture/domain/routing/persistence changes.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Members settings tab had hidden event/budget UI (`display="none"`) and lacked visible event assignment overview per member/household.
  - What changed: Replaced hidden members-panel budget blocks with visible active-scenario event grouping list built from `buildScenarioEventViews`; grouped by `memberId` with fallback `household`; added per-event “go to edit” links to Money flow and added fixed household card for unassigned events; added corresponding i18n keys.
  - Affected paths: apps/web/components/settings/ScenarioSettingsWorkspace.tsx; apps/web/messages/zh-HK.json; apps/web/messages/en.json
  - Guardrails for next agent: Keep this panel scoped to active scenario data only; use scenario-level event views + member linkage and avoid cross-scenario/case aggregation.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Completing onboarding could immediately trigger cloud save revision conflict because local cloud meta revision was not updated after onboarding server save.
  - What changed: Updated onboarding v2 and v3 completion save flows to call `useScenarioCloudStore.getState().markSaved(...)` with the server-returned revision/lastSavedAt after `saveScenarioPayloadAction` succeeds, keeping subsequent Save to Cloud requests in-sync.
  - Affected paths: apps/web/src/features/onboarding/OnboardingDraftWizard.tsx; apps/web/src/features/onboarding/v3/OnboardingV3Wizard.tsx; AGENTS.md
  - Guardrails for next agent: Any flow that performs direct server save outside ScenarioSaveToolbar must also update scenarioCloudStore revision metadata immediately to avoid stale expectedRevision conflicts.
  - Context / Why: Scenario settings persistence tab had mixed responsibilities (sync/account controls + budget rules + data tools), which conflicted with current product IA goal of a single "Data Management" focus.
  - What changed: Refactored `Tabs.Panel value="persistence"` UI to only expose Data Management JSON export entry, removed sync/account and budget-rules interactive surfaces from this tab, and added explicit deprecated-readonly notice copy; updated zh-HK/en i18n keys to reflect the streamlined IA and marked obsolete microcopy as deprecated.
  - Affected paths: apps/web/components/settings/ScenarioSettingsWorkspace.tsx; apps/web/messages/zh-HK.json; apps/web/messages/en.json; AGENTS.md
  - Guardrails for next agent: Keep budgetRules data/store compatibility intact unless migration+engine compatibility plan is provided; do not reintroduce account-level sync controls in scenario settings persistence tab; keep this tab focused on scenario data management/export.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Members settings panel showed assigned cashflow events as empty because grouping relied only on event-library `memberId`, while current owner is persisted on scenario-level cashflow events.
  - What changed: Updated `buildScenarioEventViews` to prefer scenario cashflow event `memberId` over library defaults when composing views; this keeps member/household event grouping accurate in Scenario Settings. Added unit test coverage for the scenario-member override behavior.
  - Affected paths: apps/web/src/domain/events/utils.ts; apps/web/src/domain/events/__tests__/utils.test.ts; AGENTS.md
  - Guardrails for next agent: When displaying or aggregating member-linked events, use scenario-level event ownership as source of truth and treat event-library `memberId` as fallback/default only.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: DataManagementSection still exposed snapshot/import/reset controls while current IA requires a single export-only data copy flow with explicit action feedback.
  - What changed: Simplified `DataManagementSection` to export-only behavior (`selectPersistedState` + `exportJSON`) and removed snapshot/import/danger/autosave UI logic; reduced `dataManagement` i18n namespace (zh-HK/en) to download-copy wording with dedicated export success/failure notification keys.
  - Affected paths: apps/web/components/DataManagementSection.tsx; apps/web/messages/zh-HK.json; apps/web/messages/en.json; AGENTS.md
  - Guardrails for next agent: Keep Data Management focused on JSON download copy unless IA changes are explicitly approved; any future destructive/import flows should live elsewhere with separate UX review.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Settings → Members tab could show empty assignments when cashflow events existed in `scenario.events` but were missing or out-of-sync in `eventRefs`/event library linkage.
  - What changed: Extended event view composition to support scenario cashflow fallback paths and member assignment resolution with precedence `scenario.events[].memberId` over library defaults; added `linkState` metadata (`linked`/`orphaned`) and a member-focused selector used by settings members tab so active-scenario events remain visible even under partial linkage mismatch; added tests for orphaned fallback and members-tab rendering.
  - Affected paths: apps/web/src/domain/events/types.ts; apps/web/src/domain/events/utils.ts; apps/web/src/domain/events/__tests__/utils.test.ts; apps/web/components/settings/ScenarioSettingsWorkspace.tsx; apps/web/components/settings/__tests__/ScenarioSettingsWorkspace.members.test.tsx; AGENTS.md
  - Guardrails for next agent: Treat `scenario.events` cashflow list as authoritative for member ownership and use event-library memberId only as fallback; keep members-tab assignment scoped to active scenario; preserve `linkState` for UI remediation instead of silently dropping unmatched rows.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Money、資產與負債卡片的標籤樣式規則分散在多個元件，造成 Badge / Text / Button 顯示不一致與重複維護成本。
  - What changed: 新增 `MoneyMetaTags` + `moneyTagConfig` 集中管理 tag token（size/variant/radius/color/icon/priority），並將 `IncomeEventList`、`ExpenseEventList`、`EventTypeBadge`、`ScenarioAssetManager`、`ScenarioLiabilityManager` 的 metadata 標籤統一改為該共用元件渲染；同時補上 `eventAdjustmentCountBadge` i18n key（zh-HK/en）。
  - Affected paths: apps/web/src/features/money/MoneyMetaTags.tsx; apps/web/src/features/money/moneyTagConfig.ts; apps/web/src/features/money/EventTypeBadge.tsx; apps/web/src/features/money/IncomeEventList.tsx; apps/web/src/features/money/ExpenseEventList.tsx; apps/web/features/assets/ScenarioAssetManager.tsx; apps/web/features/liabilities/ScenarioLiabilityManager.tsx; apps/web/messages/zh-HK.json; apps/web/messages/en.json; AGENTS.md
  - Guardrails for next agent: 新增 money/asset/liability metadata 標籤時，優先新增 `MoneyTagKind` + `moneyTagConfig`，避免在列表卡片內直接硬寫 Badge 顏色或混用 Text 來表達 tag 語意；色彩請僅使用 theme 已定義 palette 名稱（aurora/polar/ice/neutral/info/warning/danger）。
  - Validation commands run: pnpm -w lint; pnpm -w typecheck (fails due existing ScenarioSettingsWorkspace.members.test.tsx typing issue); pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Money/asset/liability tabs still assembled tag labels ad-hoc in each tab, causing inconsistent metadata semantics and ownership interpretation across domains.
  - What changed: Added unified metadata converter `buildMoneyMetaTags` (ScenarioEvent/ScenarioAsset/ScenarioLiability/InputItem → `MetaTag[]`) with consistent fields (`domain/type/kind/belongsTo/frequency/lifecycle`) and scenario-level ownership precedence; added money tag ViewModel (`buildMoneyMetaTagViewModel`) so tabs pass data while tag rendering remains centralized through `MoneyMetaTags`; refactored income, expense, event badge, asset manager, and liability manager to consume ViewModel output; added unit tests covering cashflow/housing/loan/insurance/asset/liability meta-tag output paths.
  - Affected paths: apps/web/src/domain/events/buildMoneyMetaTags.ts; apps/web/src/features/money/moneyMetaTagViewModel.ts; apps/web/src/features/money/IncomeEventList.tsx; apps/web/src/features/money/ExpenseEventList.tsx; apps/web/src/features/money/EventTypeBadge.tsx; apps/web/features/assets/ScenarioAssetManager.tsx; apps/web/features/liabilities/ScenarioLiabilityManager.tsx; apps/web/src/features/money/__tests__/moneyMetaTagViewModel.test.ts; apps/web/messages/zh-HK.json; apps/web/messages/en.json; AGENTS.md
  - Guardrails for next agent: Keep `belongsTo` resolution sourced from scenario-level owner/member fields only (no event-library default override in ViewModel); add any new money metadata dimensions in converter + ViewModel first, then let tabs pass raw entity data only.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck (fails due pre-existing ScenarioSettingsWorkspace.members.test.tsx typing issue); pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Money income/expense event lists still contained hardcoded Chinese adjustment copy, violating i18n key-only UX consistency and making future MoneyMetaTags strings harder to reuse.
  - What changed: Replaced hardcoded adjustment summary/expand-collapse/add-adjustment labels in `IncomeEventList` and `ExpenseEventList` with `t(...)` keys; added corresponding zh-HK/en message keys including generic MoneyMetaTags label keys (`type/kind/frequency/belongsTo/domain` + domain variants) to avoid component fallback copy; added tests covering key-based rendering and locale message key presence.
  - Affected paths: apps/web/src/features/money/IncomeEventList.tsx; apps/web/src/features/money/ExpenseEventList.tsx; apps/web/messages/zh-HK.json; apps/web/messages/en.json; apps/web/src/features/money/__tests__/MoneyEventList.i18n.test.tsx; apps/web/src/features/money/__tests__/moneyMessagesMetaKeys.test.ts; AGENTS.md
  - Guardrails for next agent: Money event list UI text must come from `money` namespace keys only; when adding MoneyMetaTags dimensions, add locale keys in zh-HK/en simultaneously and cover with test assertions.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck (fails due pre-existing ScenarioSettingsWorkspace.members.test.tsx typing issue); pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Money tags relied heavily on ad-hoc color choices, making cross-tab semantics inconsistent and harder to distinguish for users with limited color perception.
  - What changed: Added semantic color registry `moneyTagSemanticColorMap` (`domain-income/expense/asset/liability`, `meta-frequency/owner/adjustment`, etc.) and refactored tag configs to consume semantic keys mapped to Aurin palette tokens only; introduced domain-specific type tags (`incomeType`/`expenseType`) and unified non-color cues (prefix + icon + priority order) in `MoneyMetaTags`; added tests encoding UI acceptance checklist for semantic consistency, non-overlapping domain colors, and non-color signal requirement.
  - Affected paths: apps/web/src/features/money/moneyTagConfig.ts; apps/web/src/features/money/MoneyMetaTags.tsx; apps/web/src/features/money/moneyMetaTagViewModel.ts; apps/web/src/features/money/__tests__/moneyMetaTagViewModel.test.ts; apps/web/src/features/money/__tests__/moneyTagConfig.semantic.test.ts; AGENTS.md
  - Guardrails for next agent: Add new money tag semantics through `moneyTagSemanticColorMap` first, then map tag kinds via semantic keys; keep prefix/icon/order so color is never the sole discriminator; avoid raw color names in money tag components.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Income/Expense money cards had duplicated card-layout and month/projection/adjustment rendering logic, causing section-order drift risk between tabs.
  - What changed: Added shared `MoneyEventCard` with fixed section order (title+amount → meta tags → month range → projection summary → adjustment summary → actions); extracted shared helpers in `eventCardUtils` (`resolveProjectionPreviewRow`, `resolveDisplayMonths`, `resolveAdjustmentSummary`); refactored `IncomeEventList` and `ExpenseEventList` to keep only domain-specific differences while reusing shared card structure; expanded tests to assert section order consistency for both tabs and helper behavior.
  - Affected paths: apps/web/src/features/money/MoneyEventCard.tsx; apps/web/src/features/money/eventCardUtils.ts; apps/web/src/features/money/IncomeEventList.tsx; apps/web/src/features/money/ExpenseEventList.tsx; apps/web/src/features/money/__tests__/EventCardList.test.tsx; apps/web/src/features/money/__tests__/MoneyEventList.i18n.test.tsx; apps/web/src/features/money/__tests__/eventCardUtils.test.ts; AGENTS.md
  - Guardrails for next agent: Keep money event card section order fixed via `MoneyEventCard`; place shared month/projection/adjustment derivation in `eventCardUtils` first before adding list-specific logic; income/expense lists should only diverge for domain semantics (e.g. growth badge, adjustment detail expansion source).
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Money metadata tags still encoded icon glyphs as freeform strings, which made icon semantics inconsistent and reduced accessibility/non-color signal consistency across cards.
  - What changed: Switched `moneyTagConfig.icon` from raw glyph strings to typed icon keys; added centralized icon registry rendering in `MoneyMetaTags` using unified SVG icon components with shared size/stroke/spacing aligned to theme tokens; kept fixed `priority` sorting and updated semantic tests to validate non-color cues are jointly provided by `prefix + icon + order`.
  - Affected paths: apps/web/src/features/money/moneyTagConfig.ts; apps/web/src/features/money/MoneyMetaTags.tsx; apps/web/src/features/money/__tests__/moneyTagConfig.semantic.test.ts; AGENTS.md
  - Guardrails for next agent: Add new money tag icon semantics by extending `MoneyTagIconKey` + icon registry together, keep icons decorative (`aria-hidden`) with readable text label preserved, and maintain shared icon sizing/stroke via centralized constants instead of per-tag overrides.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Inputs tab cards lacked MoneyMetaTags parity with Money/Asset/Liability cards and still used hardcoded Chinese concatenation for event adjustment summaries.
  - What changed: Added inputs-level meta-tag view-model helpers so `inputEventItems`/v2 `inputAssetItems` derive `MoneyTagItem[]` via `buildMoneyMetaTagViewModel`; added minimal rule tags (`TYPE`/`LIFE`) for `inputRuleItems`; refactored input event description composition to i18n key-based `inputsEventMetaWithAdjustments`; rendered `MoneyMetaTags` in Inputs cards; added locale keys and tests for input tags + i18n summary rendering.
  - Affected paths: apps/web/app/[locale]/money/MoneyClient.tsx; apps/web/src/features/money/inputItemsViewModel.ts; apps/web/src/features/money/__tests__/inputItemsViewModel.test.ts; apps/web/src/features/money/__tests__/moneyMessagesMetaKeys.test.ts; apps/web/messages/zh-HK.json; apps/web/messages/en.json; AGENTS.md
  - Guardrails for next agent: Keep Inputs tab tag semantics aligned with MoneyMetaTags pipeline (event/asset through `buildMoneyMetaTagViewModel`), and keep input summary copy key-based (no hardcoded locale sentence concatenation in component logic).
  - Validation commands run: pnpm -w lint; pnpm -w typecheck (fails due pre-existing ScenarioSettingsWorkspace.members.test.tsx typing issue); pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Money tabs had three UX regressions: one-off “13th month bonus” income events were hidden, expense cards could miss household ownership metadata badges, and cash assets lacked a cash-specific icon alignment in meta tags.
  - What changed: Updated income grouping to include standalone non-monthly income events outside recurring salary-adjustment groups; updated money meta-tag ViewModel to always emit ownership tag (member name or household fallback) for consistent expense ownership display; added a dedicated `cashType` money tag/icon mapping and switched cash assets to use this icon for visual alignment with design expectations.
  - Affected paths: apps/web/src/features/money/incomeViewModels.ts; apps/web/src/features/money/moneyMetaTagViewModel.ts; apps/web/src/features/money/moneyTagConfig.ts; apps/web/src/features/money/MoneyMetaTags.tsx; apps/web/src/features/money/__tests__/incomeViewModels.test.ts; apps/web/src/features/money/__tests__/moneyMetaTagViewModel.test.ts; AGENTS.md
  - Guardrails for next agent: Keep one-off/yearly/quarterly income events visible in Money Income list even when salary adjustment grouping logic runs; always show ownership semantic tag for money cards (household is explicit, not implicit); use `moneyTagConfig` kind mapping for new icon needs instead of ad-hoc per-component SVG overrides.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck (fails due pre-existing ScenarioSettingsWorkspace.members.test.tsx typing issue); pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Workspace `pnpm -w typecheck` was blocked by `ScenarioSettingsWorkspace.members.test.tsx` using a Vitest mock-factory signature incompatible with current local `vi.mock` typing and by an incomplete scenarioStore mock missing `selectPersistedState` used by DataManagementSection.
  - What changed: Updated the test to use a strictly typed direct mock object for `scenarioStore` exports (`getScenarioById`, `resolveScenarioIdFromQuery`, `createMemberId`, `selectPersistedState`, `useScenarioStore`) so both typecheck and test runtime remain stable.
  - Affected paths: apps/web/components/settings/__tests__/ScenarioSettingsWorkspace.members.test.tsx; AGENTS.md
  - Guardrails for next agent: When mocking `scenarioStore` in settings tests, include `selectPersistedState` whenever rendering components that mount `DataManagementSection`; prefer string-path `vi.mock(..., () => ({ ... }))` shape compatible with current repo Vitest typing.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Money expense cards could show `家庭` in meta tags even when the event editor had a selected member, because member lookup was not passed through expense card meta-tag view model.
  - What changed: Passed `memberLookupRecord` into `ExpenseEventList` and wired it from `MoneyClient` so ownership tag resolves to member display name when `memberId` exists; added regression test covering expense meta tag ownership rendering with member lookup.
  - Affected paths: apps/web/src/features/money/ExpenseEventList.tsx; apps/web/app/[locale]/money/MoneyClient.tsx; apps/web/src/features/money/__tests__/MoneyEventList.i18n.test.tsx; AGENTS.md
  - Guardrails for next agent: For money meta tags, always pass both owner id and member lookup when rendering ownership badges; without lookup, member-owned events will degrade to household label.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Plan Lab header actions had overlapping badges and mixed-priority controls, making IA hierarchy unclear across edit/compare/save workflows.
  - What changed: Reorganized Plan Lab header actions into primary/secondary/tertiary groups with desktop grouped panels and a mobile simplified action sheet; replaced overlapping status badges with a single flow-step pill (`Draft` / `Comparing` / `Ready to Save`); replaced Edit/Compare segmented toggle with explicit enter/exit compare CTA and kept toast feedback on mode switch; added corresponding zh-HK/en i18n keys for new IA copy.
  - Affected paths: apps/web/features/planLab/PlanLabPanel.tsx; apps/web/messages/zh-HK.json; apps/web/messages/en.json; AGENTS.md
  - Guardrails for next agent: Keep Plan Lab header IA grouped by workflow priority (experiment editing, compare context, save actions); avoid restoring multi-badge status semantics when a single flow-step indicator is sufficient; new Plan Lab CTA copy must be added to both zh-HK/en message files.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Plan Lab metadata conversion and row grouping logic were duplicated inside panel branches, making compare/base behavior drift-prone and ownership precedence harder to enforce.
  - What changed: Added `planLabMetaTagAdapter` (Plan Lab row → metadata ViewModel) that reuses `buildMoneyMetaTags` + `buildMoneyMetaTagViewModel` as the single semantics source; updated `PlanLabPanel` baseline rows to route through the adapter and preserve `linkState`; added extensible grouping selector `buildPlanLabGroups(items, mode, groupBy)` supporting `domain|member|timeBucket(startMonth)` with compare-mode impact sorting (high→low).
  - Affected paths: apps/web/features/planLab/planLabMetaTagAdapter.ts; apps/web/features/planLab/planLabGrouping.ts; apps/web/features/planLab/PlanLabPanel.tsx; apps/web/features/planLab/__tests__/planLabMetaTagAdapter.test.ts; apps/web/features/planLab/__tests__/planLabGrouping.test.ts; AGENTS.md
  - Guardrails for next agent: Keep Plan Lab metadata semantics delegated to money-domain converters only; preserve scenario-level member/owner precedence over library defaults; keep orphaned/linked state in adapter output for UI consistency; extend grouping via selector layer instead of per-branch UI mapping.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Plan Lab baseline rows still used text-heavy meta summaries and lacked explicit grouping control + linkState visibility parity with settings members semantics.
  - What changed: Updated `PlanLabAccordionRow` and `PlanLabBundleItemRow` to render adapter-driven Money-style metadata tags (domain/type/frequency/belongsTo/lifecycle) and downgraded duplicated text meta display; added Plan Lab group-by segmented control (Domain/Member/Start Month) with mode-based defaults (`compare`→`member`, others→`domain`); extended `planLabMetaTagAdapter` to localize lifecycle labels, append orphaned linkState tag, and preserve household fallback/member ownership semantics; added adapter tests covering member ownership, household fallback, and orphaned display; added corresponding zh-HK/en i18n keys.
  - Affected paths: apps/web/features/planLab/PlanLabPanel.tsx; apps/web/features/planLab/planLabMetaTagAdapter.ts; apps/web/features/planLab/__tests__/planLabMetaTagAdapter.test.ts; apps/web/messages/zh-HK.json; apps/web/messages/en.json; AGENTS.md
  - Guardrails for next agent: Keep Plan Lab row metadata sourced from adapter/MoneyMetaTags (avoid reintroducing duplicated plain-text summaries for the same semantics); if adding new group modes or link states, update i18n keys and tests for member/household/orphaned rendering together.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Plan Lab compare mode lacked a concise decision layer and had weak linkage between Top Drivers interactions and timeline/chart focus.
  - What changed: Added a decision summary card above KPI cards in Plan Lab (goal timing delta, cash risk trend + risk level mirrored from cash risk scorecard, top positive/negative drivers), upgraded compare delta label to full i18n key with A/B tooltip definition, and made Top Drivers clicks lock/highlight the corresponding month in timeline preview via existing `lockedMonthIdx`/crosshair state while still locating controls.
  - Affected paths: apps/web/features/planLab/PlanLabPanel.tsx; apps/web/messages/zh-HK.json; apps/web/messages/en.json; AGENTS.md
  - Guardrails for next agent: Keep decision narrative strings under `overview.planLab*` keys (no hardcoded narrative copy), and when adding new driver interactions continue reusing the shared chart/timeline lock state to avoid dual sources of truth.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-03
  - Context / Why: Plan Lab、Money、Settings 之間的 ownership/tag/source 語意仍有模組差異，且 Plan Lab 修正流程缺少到 Money/Settings 的快速深連結。
  - What changed: 建立 shared view contract（`domain/type/kind/belongsTo/linkState/source`）並由 money meta pipeline 輸出；Plan Lab row metadata 改為注入 shared `source`（baseline-only / experiment-only / applied-to-scenario）與 source badge；在 Plan Lab 散件列加入「前往 Money 編輯」與「前往 Settings members」深連結 helper；Settings members 卡片改為使用同一 money meta tags（含 ownership + source/link-state 語意）顯示。
  - Affected paths: apps/web/src/domain/events/eventTaxonomy.ts; apps/web/src/domain/events/buildMoneyMetaTags.ts; apps/web/src/domain/events/eventMappingRegistry.ts; apps/web/features/planLab/PlanLabPanel.tsx; apps/web/features/planLab/planLabMetaTagAdapter.ts; apps/web/components/settings/ScenarioSettingsWorkspace.tsx; apps/web/src/features/money/moneyMetaTagViewModel.ts
  - Guardrails for next agent: 跨模組（Plan Lab/Money/Settings）顯示事件語意時，必須以 shared contract 欄位為單一來源；新增來源狀態時先擴充 taxonomy contract，再同步 Plan Lab badge 與 Money/Settings tag 呈現；Plan Lab 的修正入口需維持可直接 deep-link 到 Money edit 與 Settings members。
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-04
  - Context / Why: PlanLabPanel accumulated UI technical debt from hidden dead banner code, mixed action verb wording, and fallback-heavy visible copy that was not fully grounded in locale messages.
  - What changed: Removed `display="none"` hidden summary/banner dead code in PlanLab accordion rows; standardized PlanLab experiment action wording from 「建立」to「新增」for button/notification-style actions; added missing Plan Lab overview i18n keys used as fallbacks (`planLabExperimentLandingTitle`, `planLabEventExperimentCreate`, `planLabEventExperimentBundleHint`, `planLabEventExperimentDrawerHint`, `planLabCreateExperimentAction`, `planLabBundleCreateExperiment`, `planLabKpiDeltaCompareLabel`, `planLabKpiDeltaLabel`) in zh-HK/en; added `PlanLabPanel.i18n.test.ts` guardrail tests to prevent reintroducing hidden dead code and hardcoded experiment action literals while verifying required message keys exist.
  - Affected paths: apps/web/features/planLab/PlanLabPanel.tsx; apps/web/features/planLab/__tests__/PlanLabPanel.i18n.test.ts; apps/web/messages/zh-HK.json; apps/web/messages/en.json; AGENTS.md
  - Guardrails for next agent: In PlanLabPanel, visible user text should come from translation keys first; fallback copy is safety-only and any repeatedly-used fallback must be promoted to zh-HK/en message files; keep experiment action verb semantics consistent (新增 = action trigger, 套用 = apply current draft, 儲存 = persist).
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-04
  - Context / Why: Onboarding v3 cashflow events retained internal `onboarding:v3:*` tags after submit, causing Plan Lab baseline cards to surface onboarding category-code strings (e.g. `onboarding:v3:expense:daily-monthly`) in UI metadata.
  - What changed: Updated onboarding v3 `mapOnboardingV3EventTypes` to strip `onboarding:v3:*` tags after semantic mapping while preserving functional tags (e.g. `tax`, `income:rental`); added mapper test coverage for tag stripping and updated onboarding mapping doc with the internal-tag cleanup rule.
  - Affected paths: apps/web/src/features/onboarding/v3/eventTypeMapper.ts; apps/web/src/features/onboarding/v3/__tests__/eventTypeMapper.test.ts; docs/onboarding-v3-event-mapping.md; AGENTS.md
  - Guardrails for next agent: Treat `onboarding:v3:*` tags as onboarding-internal transport metadata only—do not rely on them for runtime UI categorization after onboarding submission; preserve semantic tags required by downstream category logic.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-04
  - Context / Why: Settings members tab Add Member flow only exposed a seed-defaults switch and created members with default placeholder values first, which risked incomplete member data and weak required-field UX feedback.
  - What changed: Refactored Add Member modal into a structured form draft (`name/kind/basis/birthMonth/ageAtBaseMonth`) with validation state; added reusable `validateAddMemberDraft` and `buildMemberFromAddDraft` helpers; updated submit path to build full member payload directly from user input (including month normalization via `normalizeMonthStrict`) before `createMember(...)`; added zh-HK/en i18n keys for modal labels/hints; expanded members test suite to cover required-field validation and complete member payload creation.
  - Affected paths: apps/web/components/settings/ScenarioSettingsWorkspace.tsx; apps/web/components/settings/__tests__/ScenarioSettingsWorkspace.members.test.tsx; apps/web/messages/zh-HK.json; apps/web/messages/en.json; AGENTS.md
  - Guardrails for next agent: Keep Add Member submission input-first (no placeholder member creation then patch); retain validation + normalization behavior parity with members edit forms; keep `createMember` scoped to active scenario boundary semantics.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-04
  - Context / Why: Scenario Settings members add-member modal still offered default seeding toggle and add-member flow created event/budget side effects, conflicting with current requirement that member creation is isolated from event/budget writes.
  - What changed: Removed `seedDefaultsOnAddMember` state and modal Switch UI; simplified add-member persistence path to member-only creation via `persistNewMember`; removed `members.seedDefaultsLabel` locale keys (zh-HK/en); added members workspace unit test asserting no event/budget upsert side effects when persisting a new member; confirmed `buildDefaultsForNewMember` has no remaining call sites (now dead-code candidate for follow-up PR).
  - Affected paths: apps/web/components/settings/ScenarioSettingsWorkspace.tsx; apps/web/components/settings/__tests__/ScenarioSettingsWorkspace.members.test.tsx; apps/web/messages/zh-HK.json; apps/web/messages/en.json; AGENTS.md
  - Guardrails for next agent: Keep add-member action scoped to member entity creation only unless product explicitly reintroduces guided defaults with separate UX and data-scope review; if removing `buildDefaultsForNewMember`, do so in dedicated cleanup PR with dependency audit.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-04
  - Context / Why: Members accordion rows allowed inline editing (TextInput/Select/NumberInput) with immediate onChange writes, which conflicted with read-only list UX and made edit/save intent unclear.
  - What changed: Converted member accordion panel fields to read-only descriptors (Text/Badge rows), added per-member Edit action opening in-file `EditMemberModal`, reused add-member draft fields/validation for edit flow, and changed member update path to save-once (`updateMember(member.id, patch)` only on modal Save); kept member delete action inside modal footer and added zh-HK/en i18n keys (`editMember`, `saveMember`, `discardChanges`); expanded members settings tests to assert read-only list semantics and save-patch transformation coverage.
  - Affected paths: apps/web/components/settings/ScenarioSettingsWorkspace.tsx; apps/web/components/settings/__tests__/ScenarioSettingsWorkspace.members.test.tsx; apps/web/messages/zh-HK.json; apps/web/messages/en.json; AGENTS.md
  - Guardrails for next agent: Keep members accordion display read-only; route edits through explicit modal draft state and commit only on Save; avoid reintroducing inline onChange writes in member list rows.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-04
  - Context / Why: Scenario Settings members/month-related form fields used generic `TextInput` with duplicated month parsing logic, while shared month input behavior (native month picker + clear affordance) already exists in `MonthField`.
  - What changed: Applied shared `MonthField` in `ScenarioSettingsWorkspace` for Add/Edit member birth-month input and assumptions base-month modal input; preserved existing normalization/validation (`normalizeMonthStrict`, `validation.useYearMonth`) and error reset behavior while switching handlers to string-based `onChange`.
  - Affected paths: apps/web/components/settings/ScenarioSettingsWorkspace.tsx; AGENTS.md
  - Guardrails for next agent: Prefer `MonthField` for scenario/settings month-form UX to keep month picker/clear interactions consistent; keep strict month normalization on blur/save paths and avoid bypassing existing validation messages.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-04
  - Context / Why: 設定→成員設定在部分情境下無法顯示已關聯事件，主因是 `scenario.events` 的 cashflow 項目若沒有對應 event library definition，會被 `buildScenarioEventViews` 直接略過，導致成員卡片顯示「尚未關聯任何事件」。
  - What changed: 調整 `createFallbackEventViewFromScenarioEvent`，即使 event library 缺少對應 definition，也會以 scenario cashflow event 自身資料建立 fallback `ScenarioEventView`（含 `id/title/memberId/rule`，legacy type 由 `mapScenarioCashflowToLegacyType` 推導）；保留 `linkState: orphaned`，確保 members tab 仍可顯示並導向修正。新增單元測試覆蓋「無 library 定義仍可顯示 member assignable event」案例。
  - Affected paths: apps/web/src/domain/events/utils.ts; apps/web/src/domain/events/__tests__/utils.test.ts; AGENTS.md
  - Guardrails for next agent: 成員關聯事件顯示應以 active scenario `scenario.events` 為最後保底來源，不可因 event library 缺項而整筆消失；若後續要限制 fallback 顯示，需先提供 UI remediation 路徑與遷移策略。
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-04
  - Context / Why: Settings members tab and Plan Lab meta tags still surfaced internal enum strings (e.g., baseline-only/orphaned/domain-kind raw text), causing visible non-i18n labels and inconsistent tag semantics across pages.
  - What changed: Updated settings members-tag resolver to use money/members translation keys for type, frequency, lifecycle, source, and link-state labels; refactored Plan Lab meta-tag adapter to receive localized type labels and interval-month formatter from caller instead of hardcoded strings; added/updated zh-HK/en locale keys for member tag source/link-state labels and Plan Lab interval label; aligned related tests with key-based rendering.
  - Affected paths: apps/web/components/settings/ScenarioSettingsWorkspace.tsx; apps/web/features/planLab/planLabMetaTagAdapter.ts; apps/web/features/planLab/PlanLabPanel.tsx; apps/web/components/settings/__tests__/ScenarioSettingsWorkspace.members.test.tsx; apps/web/features/planLab/__tests__/planLabMetaTagAdapter.test.ts; apps/web/messages/zh-HK.json; apps/web/messages/en.json; AGENTS.md
  - Guardrails for next agent: Any new money/meta tag label must come from translation keys via resolver callbacks; avoid direct enum string rendering in UI tags (domain/kind/frequency/lifecycle/source/linkState) and pass localized formatters from route-level adapters when composing tags.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-04
  - Context / Why: Money income summary could show salary-dominant cards while KPI "non-salary income ratio" reported unexpected values because salary detection depended on English keyword matching (`salary`) instead of structured subtype semantics.
  - What changed: Added structured ledger classification support (`CashflowItem.incomeSubtype`, `LedgerRow.incomeSubtype`) and threaded subtype metadata from scenario/event compilation into projection ledgers (legacy + V2); updated `computeIncomeCoverageRatios` to prioritize `incomeSubtype === salary` and keep keyword matching as transitional fallback with explicit fallback usage counters; surfaced KPI explainability in Money income summary (ratio card + numerator/denominator formula + fallback classification hint) with zh-HK/en i18n copy.
  - Affected paths: apps/web/src/domain/ledger/types.ts; apps/web/src/engine/scenarioV2Compiler.ts; apps/web/src/engine/useProjectionWithLedger.ts; apps/web/src/engine/usePlanLabProjectionWithLedger.ts; apps/web/src/domain/kpis/incomeCoverage.ts; apps/web/src/domain/kpis/__tests__/incomeCoverage.test.ts; apps/web/app/[locale]/money/MoneyClient.tsx; apps/web/src/features/money/IncomeSummarySection.tsx; apps/web/messages/zh-HK.json; apps/web/messages/en.json; AGENTS.md
  - Guardrails for next agent: For income composition KPIs, prefer structured subtype semantics over text heuristics; if fallback keyword classification is still triggered in UI, treat it as migration/normalization debt and avoid adding new KPI logic that relies on sourceId/label keyword parsing.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-04
  - Context / Why: Settings → Members tab related-event cards used a bespoke compact row format that did not align with Money area card hierarchy/meta tag presentation, causing visual/semantic inconsistency.
  - What changed: Refactored `ScenarioSettingsWorkspace` related-event rendering into shared `renderRelatedEventCard` with card structure aligned to Money cards (title + primary amount + MoneyMetaTags + period row + action), and reused it for both member and household sections.
  - Affected paths: apps/web/components/settings/ScenarioSettingsWorkspace.tsx; AGENTS.md
  - Guardrails for next agent: Keep Members-tab related events using `MoneyMetaTags` and the unified card section order; avoid reintroducing ad-hoc `Badge + tiny text` tag rows for this panel.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-05
  - Context / Why: Milestone semantics diverged across members life-stage fields and overview timeline markers, creating dual data sources and inconsistent UX wording.
  - What changed: Unified Milestone UX semantics to "previewable-impact event node" in Settings/Overview copy; stopped creating default `members.milestones` for new members and marked it as legacy read-only in Settings UI; added `MilestoneEvent.templateType` to represent member life-stage templates (`member_birth/member_school_start/member_retirement/custom`); introduced `buildOverviewTimelineMarkers` selector to aggregate timeline markers from `scenario.milestoneEvents` + highlighted events in one source for Overview charts/next-key-event.
  - Affected paths: apps/web/components/settings/ScenarioSettingsWorkspace.tsx; apps/web/app/[locale]/overview/OverviewClient.tsx; apps/web/src/domain/timeline/buildOverviewTimelineMarkers.ts; apps/web/src/domain/milestoneEvents/types.ts; apps/web/messages/zh-HK.json; apps/web/messages/en.json; apps/web/components/settings/__tests__/ScenarioSettingsWorkspace.members.test.tsx; apps/web/src/domain/timeline/__tests__/buildOverviewTimelineMarkers.test.ts
  - Guardrails for next agent: Treat `members.milestones` as legacy/readonly UI data only; when adding timeline markers in Overview, always go through `buildOverviewTimelineMarkers` and pass both milestoneEvents + highlighted events to avoid dual marker sources; represent member life-stage defaults via `MilestoneEvent.templateType` instead of exposing new persistent member milestone editing.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-05
  - Context / Why: Overview scenario main flow lacked a direct, in-shell milestone-event entry and did not provide scenario-isolated apply feedback with visible post-apply state change.
  - What changed: Mounted `EventManager` + `EventWizard` in `app/[locale]/overview/OverviewClient.tsx` under existing app shell/locale flow; wired wizard apply/delete to `activeScenarioId` only (guarding against non-active scenario writes) and invoked store `applyMilestoneEvent(activeScenarioId, draft)`; added global notification feedback for validation/apply/delete plus list-item highlight state after successful apply; extended `EventWizard` with validation feedback callback and step-transition gating based on real-time `compileEventToOps` results while keeping fixed 4-step flow.
  - Affected paths: apps/web/app/[locale]/overview/OverviewClient.tsx; apps/web/features/milestoneEvents/EventWizard.tsx; apps/web/features/milestoneEvents/EventManager.tsx; apps/web/messages/zh-HK.json; apps/web/messages/en.json; AGENTS.md
  - Guardrails for next agent: Milestone apply path in Overview must use active scenario context/store only; keep wizard fixed at 4 steps with compile-driven validation surfaced both globally (toast/notification) and field-level errors; preserve visible post-apply confirmation (success feedback + list highlight/animation cue).
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
- Date: 2026-03-05
  - Context / Why: Overview milestone list lacked closed-loop edit/delete UX safeguards and Money timeline cards did not expose milestone-generated source traceability for generated events.
  - What changed: Added milestone event manager delete confirmation modal + transitional removal state animation and async delete contract; wired overview delete flow to return success/failure with rollback attempt and error toast feedback; added milestone-generated source tagging in Money income/expense cards using existing money tag system (`eventGeneratedBadge`) plus trace text resolved from originating milestone notes/id; added new i18n keys for delete confirm/failure/source trace in zh-HK/en.
  - Affected paths: apps/web/features/milestoneEvents/EventManager.tsx; apps/web/app/[locale]/overview/OverviewClient.tsx; apps/web/app/[locale]/money/MoneyClient.tsx; apps/web/src/features/money/IncomeEventList.tsx; apps/web/src/features/money/ExpenseEventList.tsx; apps/web/messages/zh-HK.json; apps/web/messages/en.json; AGENTS.md
  - Guardrails for next agent: Keep milestone-generated source labels driven by scenario-local milestoneEvents + definition.generatedByEventId mapping only; preserve explicit delete safeguard UX (confirm or equivalent undo) and failure rollback feedback for milestone operations.
  - Validation commands run: pnpm -w lint; pnpm -w typecheck; pnpm -w test; pnpm -w --filter web build
