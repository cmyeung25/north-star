# Onboarding V2 Rollout Plan (PR-ONB-01 ~ PR-ONB-12)

> Goal: Replace Onboarding V1 with V2 while keeping engine unchanged, avoiding scenario pollution, and ensuring data correctness (net worth, cashflow, liabilities linkage).

---

## 0) Product Goals & Principles

### Goals
- First-time users can complete onboarding quickly and get immediate value:
  - net monthly cashflow
  - net worth
  - cash buffer (months)
  - time-to-X (e.g. +100k/+500k/+1M)
  - 5-year projection snapshot
- Reduce post-onboarding data backfill by collecting more data upfront.
- Keep data model correct: mortgage/loan payments must be linked to liabilities.

### Non-goals
- No engine changes.
- No major IA changes outside onboarding and its deep links (Money/Overview/Plan Lab).

### Design Principles
- “Collect more upfront, but keep it fast”: progressive disclosure + templates.
- Avoid double counting (especially housing + debts + budget).
- Month handling is strict: all month fields use MonthKey (new `month` field).
- Every recurring payment for debt must link to a Liability (`linkedLiabilityId`).
- Onboarding-generated items should be traceable (source/meta tag if schema supports).

---

## 1) Onboarding V2 IA (Step Flow)

Recommended V2 step order:

1. Profile
2. Household (Members)
3. Assumptions (Global)
4. Income
5. Living & Variable Spend
6. Housing (Rent vs Mortgage/Own)
7. Assets (Cash/Investments/Car/Policy cash value + contributions)
8. Debts (Car loan/personal loan/credit, linked payment)
9. Insurance (Premiums + savings policy asset)
10. Review (Live Summary + Data Quality + Deep links)

Notes:
- Mortgage payments must not be captured as “general expense”. Always build Liability + linked payment.
- Insurance: protection = premium only; savings/ILAS/endowment = premium + optional policy asset (cash value).

---

## 2) Rollout Strategy

### Phase A — Dual Track (Soft launch)
- Keep V1 as default initially.
- Enable V2 behind query param: `/onboarding?v=2`.
- Add V2 wizard scaffolding + draft persistence.

### Phase B — Soft Switch
- Make V2 default for `/onboarding`.
- Keep V1 as fallback via `/onboarding?v=1`.
- Add telemetry to measure completion/funnel.

### Phase C — Hard Replace
- Remove V1 flow and legacy code paths.
- `/onboarding` always V2; remove `?v=1`.
- Keep compatibility for old scenarios (onboardingVersion=1).

---

## 3) Data Mapping Rules (Critical)

### MonthKey rule
- All start/end/occurrence months use MonthKey (new `month` field).
- Never use legacy month formats.

### Liability linkage (critical)
- Every loan/mortgage payment MoneyItem must set:
  - `linkedLiabilityId = liability.id`
- This prevents net worth distortion (principal shouldn’t “disappear”).

### Double counting avoidance
- If housing creates a mortgage + payment, Debts step must not create duplicate mortgage.
- If Living Spend uses category breakdown mode:
  - do NOT also generate a single “living fixed total” item (avoid double count).

### Source tagging (recommended)
- Add `source: 'onboarding-v2'` and `section: 'income'|'living'|'housing'|...` if schema supports.
- Use stable ids/externalKey for merge safety:
  - `self`, `partner`, `child-1..n`, `pet-1..n`
  - `housing:mortgage` for primary mortgage
  - `policy-1..n` for insurance policies (stable within draft)

---

## 4) Data Quality Flags (Non-blocking)

Flags appear in Review step and do not block completion.

### High priority (red)
- income total = 0 and expense > 0
- cash = 0 and expense > 0 (cash buffer = 0)

### Medium priority (yellow)
- mortgage liability missing principal/rate/term
- loan liability missing principal/rate/term
- any payment item missing `linkedLiabilityId`
- savings policy missing cash value
- investment contribution exists but investment asset is 0

Each flag should have a “Fix” action:
- jump to relevant onboarding step, OR
- deep link to Money tab (e.g. `/money?tab=debts`)

---

## 5) PR Plan (01 ~ 12)

### PR-ONB-01 — V2 scaffolding + v1/v2 switch
- Add query switch `?v=1|2`
- Keep default V1
- Add V2 wizard shell scaffolding: step registry, progress, draft persistence, error boundary

### PR-ONB-02 — Profile + Household (Members baseline)
- Add Profile step: birthMonth, baseCurrency, horizon, startMonth
- Add Household step: partner/children/pets -> members[]
- Stable member ids

### PR-ONB-03 — Assumptions
- Add global assumptions step (inflation/incomeGrowth/investmentReturn + optional extras)
- Must reuse existing v1 assumptions storage format

### PR-ONB-04 — Income
- Add income list (monthly/quarterly/yearly/one-off)
- Map to MoneyItems (reuse existing recurrence schema; expand to oneOff series if needed)

### PR-ONB-05 — Living & Variable Spend
- Fixed living (required) + variable avg (optional)
- Optional category breakdown mode (no double count)
- Optional travel/tax annual or monthly

### PR-ONB-06 — Housing
- Rent branch -> recurring rent expense
- Mortgage/Own branch:
  - create Property asset
  - create Mortgage liability
  - create mortgagePayment MoneyItem with linkedLiabilityId
  - include one-off purchase fees + ongoing costs
  - optional rental income

### PR-ONB-07 — Assets
- Cash + Investment (stock) required/strongly recommended
- Optional investment breakdown
- Optional investment contributions (must reuse existing model)
- Optional car + savings policy cash value as assets

### PR-ONB-08 — Debts
- Multiple liabilities (carLoan/personal/credit/other)
- Amortization estimate, auto-fill payment if missing
- Create linked payment MoneyItems
- Guardrail: prevent duplicate mortgage

### PR-ONB-09 — Insurance
- Quick mode total premium OR detailed policy list
- Protection = premium only
- Savings = premium + optional policy asset (cash value), avoid duplicates via stable policy ids

### PR-ONB-10 — Review + Live Summary + Deep links
- Show live summary (cashflow, net worth, cash buffer, time-to-X, horizon KPI)
- Data Quality flags with fix actions
- Deep links into Money tabs

### PR-ONB-11 — V2 default (soft switch) + telemetry
- `/onboarding` defaults to V2
- Keep `?v=1` fallback
- Add funnel telemetry (started/step_viewed/step_completed/completed)

### PR-ONB-12 — Hard replace (remove V1)
- Remove V1 UI and legacy transforms
- `/onboarding` always V2 (no fallback)
- Keep compatibility for old scenarios + “run onboarding again” entry

---

## 6) QA Checklist & Repro Scenarios

### Smoke scenario A (Rent)
- startMonth: 2026-02
- income: 50,000 monthly
- living: 20,000 fixed + 5,000 variable
- rent: 18,000
Expected:
- net cashflow ~ 7,000/month
- no liabilities; net worth includes cash/investment if provided

### Smoke scenario B (Mortgage + rental income)
- property value: 8,000,000
- downpayment: 10%
- mortgage: 7,200,000, 3.25%, 25 years, payment entered or estimated
- purchase fee: stamp duty 240,000 one-off
- ongoing: management fee 2,000/month
- rental income: 24,000/month from 2026-03
Expected:
- mortgage liability exists
- mortgagePayment expense linked to mortgage liability
- net worth = assets - liabilities correct
- one-off fee impacts cashflow month

### Smoke scenario C (Debts + insurance)
- personal loan: 200,000, 6%, 5y (auto-filled payment)
- car loan: 300,000, 20% downpayment, 4%, 7y
- insurance: medical 1,200/mo + savings 2,000/mo cash value 150,000
Expected:
- each liability has linked payment item
- savings policy creates asset
- premiums reduce cashflow

### Regression checks
- MonthKey is used everywhere (no legacy month field).
- No double counting in living breakdown mode.
- Debts does not duplicate housing mortgage.

---

## 7) Operational Notes
- Draft persistence key should include a version prefix (e.g. `onboarding:v2:draft:<id>`).
- Provide “reset draft” option.
- Ensure incomplete scenarios do not crash Overview/Money/Plan Lab.

---

## 8) Appendix: Glossary
- MonthKey: canonical month representation used throughout store and onboarding.
- MoneyItem: recurring/oneOff cashflow item (income/expense).
- Asset/Liability: balance sheet entities impacting net worth.
- linkedLiabilityId: relationship key to connect payments to liabilities.
