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
