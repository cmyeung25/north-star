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

Dev-only E2E auth bootstrap may exist under /api/e2e/auth/* for local Playwright runs, but it must remain gated behind development-only env flags + shared secret, use a dedicated non-human Supabase account, and still land on /{locale}/member/cases. It must never weaken normal middleware/layout auth checks for production or preview traffic.

Session management is handled via Supabase (server‑side) and the AuthContext provider client‑side. Use hooks (e.g. useSession) to access the current user.

For locale‑aware redirection, the middleware reads the locale from the path or cookie (aurin_locale), and rewrites/redirects accordingly.

6 Routing best practices

Member vs. App separation

Member area (/{locale}/member/*): case management and account settings. Only lists cases or updates user profile. Member UI should be clean and simple.

App area (/{locale}/app/*): deep scenario editing, dashboards, Plan Lab and onboarding. Left nav is fixed; top bar shows case–scenario title and actions.

No direct deep linking from marketing or auth to the app. Always pass through the member area to pick a case.

Locale prefix always present. Actual pages should not be duplicated; use middleware rewrites to map /{locale}/… to a single underlying implementation.

Dev-only E2E auth bootstrap: local Playwright runs may authenticate through guarded /api/e2e/auth/bootstrap and /api/e2e/auth/reset routes using a dedicated Supabase test account and storage-state setup. Keep this strictly development-only; do not convert it into a general auth bypass or skip the /member/cases entry rule.

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


Plan Lab decision template v1 & summary layer – Plan Lab now exposes decision templates (`home_purchase`, `new_baby`, `income_shock`) directly from the Add Experiment entry. Bundle-based templates reuse existing life-event wizard paths with experiment packing, while income shock reuses baseline override flow with guard-based availability. Decision summary uses KPI-delta heuristics (risk timing/trend, top drivers, recommended actions) and does not modify engine interfaces.

Overview KPI watchlist v1 – Overview dashboard KPI rendering now uses a `library + watchlist` model. User watchlist preferences are scenario-scoped (`scenario.meta.overviewKpiWatchlist`) and must only be written for the active scenario. Editing supports add/remove/reorder and should persist through existing scenario store hydration without cross-scenario leakage.

Member create-case preset v1 - The member `/member/cases` create dialog now treats `preset` as an onboarding-prefill path only. It creates the case/scenario first, stores a scenario-scoped onboarding draft derived from an allowlisted seed, and then routes into onboarding. Do not reinterpret this member entry as direct scenario creation or skip onboarding; the current allowlist is six presets (`single-renter`, `dual-income-home`, `dual-income-rental`, `new-baby`, `new-baby-helper`, `high-asset`).

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


Record format (recommended):

- Context / Why
- What changed
- Affected paths
- Guardrails for next agent
- Validation commands run

# North Star Product Agent Rules

## Product mode
This repository is developed as a long-term product, not as isolated one-off features.
Every task must be aligned to the current product roadmap and implementation status.

## Files you must read before making changes
- docs/product/ROADMAP.md
- docs/product/IMPLEMENTATION_STATUS.md
- docs/product/DECISIONS.md
- relevant local AGENTS.md files in the target folder

## Required workflow for every task
1. Read roadmap, implementation status, and relevant decisions before coding.
2. Identify which milestone / epic / sub-task this request belongs to.
3. Prefer the smallest valid change that advances the roadmap without breaking architecture.
4. After code changes, update:
   - docs/product/IMPLEMENTATION_STATUS.md
   - docs/product/DECISIONS.md if any new architectural/product decision was made
   - roadmap checklist if a milestone/subtask is completed
5. In the final summary, always report:
   - roadmap item touched
   - implementation progress changed
   - files updated
   - remaining gaps / next recommended step

## Architecture guardrails
- Do not break engine-domain separation.
- Do not pollute the main scenario with sandbox / experiment state.
- Prefer adapter/compiler extension over UI-side business logic duplication.
- Preserve existing scenario-based isolation.

## Completion standard
A task is not complete unless:
- code is updated
- relevant tests/checks are run
- implementation status is updated
- roadmap progress is updated if applicable


## For every task you have to run below
Please work in long-term product development mode, not one-off feature mode.

Before coding:
1. Read AGENTS.md
2. Read docs/product/ROADMAP.md
3. Read docs/product/IMPLEMENTATION_STATUS.md
4. Read docs/product/DECISIONS.md
5. Identify which milestone and subtask this request belongs to

Constraints:
- minimal safe change
- preserve architecture boundaries
- do not break engine/scenario isolation
- update roadmap/status files after implementation

Definition of done:
- implement the change
- run relevant checks
- update IMPLEMENTATION_STATUS.md
- tick roadmap subtask(s) if completed
- add a short decision note if any new architecture/product rule was introduced

In your final response, report:
- milestone/subtask updated
- implementation completion delta
- remaining gaps
- recommended next step


## File Encoding Safety (Critical)

This repository contains UTF-8 text files with mixed English / Traditional Chinese content.
When editing files, always preserve the original encoding and line endings.
Never introduce mojibake or silent encoding conversion.

### Rules
1. Treat all text files as **UTF-8** unless the file explicitly indicates otherwise.
2. **Do not** use unsafe shell redirection or default PowerShell file-write commands for overwriting text files, because they may change encoding or line endings.
3. Prefer **patch-based edits** that preserve existing file bytes and only change the intended lines.
4. If a full-file rewrite is unavoidable, use an explicit UTF-8-safe method and preserve LF/CRLF style of the original file.
5. After editing any user-facing copy, markdown, config, or docs containing Chinese text, verify that no mojibake was introduced.
6. Never mass-rewrite a file just to reformat it if the task only requires a small content change.

### Preferred edit methods
- First choice: use structured patch editing / apply_patch style changes.
- Second choice: use a script that reads and writes with explicit UTF-8 encoding.
- Avoid: direct `>` redirection, `Out-File`, `Set-Content`, or other commands without explicit encoding control.

### PowerShell safety
If PowerShell must be used:
- Read with explicit UTF-8
- Write with explicit UTF-8
- Preserve newline style where possible
- Do not assume PowerShell defaults are safe

Example safe approach:
- Use .NET / script-based file IO with explicit UTF-8
- Or use Node/Python scripts with explicit `utf-8` encoding

### Validation checklist after editing
- Chinese text displays correctly
- No unexpected replacement characters such as `U+FFFD`
- No garbled text fragments such as repeated `?` runs, high-bit mojibake prefixes, or other broken UTF-8 markers
- Diff only contains intended content changes
- File did not accidentally switch encoding or line endings

### Locale JSON audit checklist
- Read locale files with an explicit UTF-8 reader (for example, Node `fs.readFileSync(..., "utf8")`) before deciding whether the file itself is corrupted; do not rely on PowerShell console rendering alone.
- Compare placeholder token sets against `apps/web/messages/en.json` for shared string keys so tokens like `{name}` and `{count}` do not drift.
- Search the target locale file for mojibake markers before and after edits (for example: `????`, `U+FFFD`, unexpected high-bit garbage prefixes, or repeated ASCII `?` runs).
- If corruption is isolated to one subtree, replace only that subtree or exact block instead of reformatting the whole locale file.
- After locale-copy edits, run at least one i18n test that exercises the affected message group and one direct scan for suspicious markers.
### Recovery rule
If encoding corruption is detected:
1. Stop further edits to the corrupted file
2. Restore the last known-good version
3. Re-apply the change using UTF-8-safe editing
4. Mention in the summary that a restore + safe reapply was performed


## Editing Constraint for Windows / PowerShell

On Windows, never overwrite markdown, JSON, TS, TSX, YAML, or text content files using default PowerShell file output commands.
Assume such commands are unsafe unless UTF-8 is explicitly enforced.

For small changes, always prefer minimal patch edits.
For scripted edits, use Python / Node with explicit UTF-8 encoding.
Do not rewrite the whole file unless necessary.

## Recommended file-edit order

1. apply_patch / minimal diff edit
2. Python script with explicit UTF-8 read/write
3. Node script with explicit UTF-8 read/write
4. Editor save with confirmed UTF-8
5. Avoid raw shell overwrite commands

When a file contains Chinese, Japanese, or other non-ASCII text, perform an explicit post-edit encoding sanity check before finishing.
