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

8 Recent changes & key PR patterns

Unified adjustment pipeline – onCreateEventAdjustment now serves as the single mechanism for creating adjustments on both income and expense events. The older onCreateSalaryAdjustment function is kept as a wrapper. The Money module has been refactored so that expense lists call the same creator.

Member → App transition improvements – Avoid two blank screens by adding a loading overlay in the member area when opening a scenario and showing an AppShell skeleton in the app area until projection data loads.

Locale‑aware routing via middleware – The actual pages live outside [locale] but are accessed through /{locale}/… via rewrites. This prevents duplication and case‑sensitivity problems while preserving locale‑specific URLs.

Account hub consolidation – All account management features (profile, security, connected accounts, data export, billing) are now under /{locale}/member/account with a tabbed Mantine UI. The old account settings routes now redirect to the new hub.

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

Adhering to this architecture will ensure that Codex agents maintain a stable, predictable system while continuing to develop new features.