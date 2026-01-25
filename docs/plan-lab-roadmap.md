# Plan Lab / Onboarding Draft Roadmap (PR0 Spike)

## Product intent
Plan Lab is a lightweight, fast-feedback flow for **micro-plans** (initially housing + baby planning) that returns projection results quickly before users graduate into a full Scenario. The intent is to **compile a minimal draft into `ProjectionInput`**, run the engine, and show ledger output without persisting anything to the Scenario store.

## Non-goals (PR0)
- No UI changes (no Drawer/Wizard, no onboarding integration).
- No changes to Scenario store, persistence, or projection pipeline behavior.
- No member/budget rule edits (`applyScope` is out of scope).
- No salary ladder edits or SmartInvest exposure.
- No new projection hook implementation yet (interfaces only).

## Current projection pipeline (reference only)
The current pipeline flows through the Scenario adapter and ledger hook:
- `apps/web/src/engine/adapter.ts` — maps `Scenario + GlobalSettings` into `ProjectionInput`.
- `apps/web/src/engine/useProjectionWithLedger.ts` — runs engine + ledger aggregation and smart invest breakdowns.

Plan Lab must **not** reuse Scenario store selectors or mutate Scenario state; it should be a **parallel, draft-only pipeline** to avoid altering global numbers.

## Draft storage strategy (PR0 scope)
PR0 defines **interfaces only**. Storage decisions are deferred:
- Option A: `localStorage` key (scoped to `planLabDraft/v1`).
- Option B: temporary in-memory store (e.g., component state).
- Option C: onboarding-specific cache (independent of Scenario store).

## Draft interface expectations (PR0)
See `apps/web/src/domain/planLab/types.ts` for minimal draft shapes. The draft is intentionally small and avoids members/budget rules.

### Hook/API boundary (design only)
- `compilePlanLabDraftToProjectionInput(draft, globalSettingsSnapshot)`
  - Converts `PlanLabDraft` into `ProjectionInput` without touching Scenario store.
  - Strict month normalization before engine execution.
- `usePlanLabProjectionWithLedger(draft, globalSettingsSnapshot?)`
  - Pure compute hook; returns projection + ledger without persistence.
  - Must be isolated from `useProjectionWithLedger` to avoid shared state or adapter overrides.

## Guardrails
- **Month parsing**: Drafts may allow partial typing in UI, but compiler must require strict `YYYY-MM` (normalized) before engine input.
- **Double counting**: Plan Lab v1 allows **one** housing option and **one** baby plan only. Avoid parallel event edits or multiple housing positions.
- **applyScope & members**: v1 does not read/modify `members` or `budgetRules`. Scope logic remains Scenario-only.
- **Housing mapping**: Buy flow should map directly to engine `homes[]` fields (down payment, fees, mortgage, holding costs) and must not add extra event rows that duplicate totals.
- **No SmartInvest**: Do not include SmartInvest inputs or salary ladder rules in Plan Lab v1.

## Roadmap
### PR0 (this spike)
- Add docs + types only.
- No UI, store, or pipeline changes.

### PR1
- Add `compilePlanLabDraftToProjectionInput` (pure function).
- Add `usePlanLabProjectionWithLedger` (compute-only hook).
- Still no UI or persistence changes.

### PR2
- Prototype UI (Drawer/Wizard) for micro-plan entry.
- Optional onboarding entry point; still draft-only until user explicitly converts to Scenario.

## Example draft payload (non-binding)
```json
{
  "baseMonth": "2025-01",
  "initialCash": 100000,
  "housing": {
    "kind": "buy",
    "purchaseMonth": "2025-06",
    "purchasePrice": 750000,
    "downPaymentPct": 0.2,
    "mortgageRatePct": 4.1,
    "termYears": 30,
    "oneTimeFees": 15000,
    "holdingCostMonthly": 2500
  },
  "babyPlan": {
    "targetMonth": "2026-03",
    "monthlyBabyBudget": 8000,
    "durationMonths": 24
  }
}
```
