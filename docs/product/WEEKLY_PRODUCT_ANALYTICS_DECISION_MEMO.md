# Weekly Product Analytics Decision Memo
Last updated: 2026-03-22

## Review window
- Fixed window: **2026-03-09 00:00 UTC → 2026-03-16 00:00 UTC**.
- Window policy: previous full Monday → Monday UTC week, per `docs/product/ONBOARDING_GUARDRAIL_WEEKLY_REVIEW_WORKFLOW.md` and `docs/product/MARKET_ENTRY_REVIEW_RITUAL.md`.

## Operating basis
- Workflow docs:
  - `docs/product/ONBOARDING_GUARDRAIL_WEEKLY_REVIEW_WORKFLOW.md`
  - `docs/product/MARKET_ENTRY_REVIEW_RITUAL.md`
- Analytics builders:
  - `apps/web/src/lib/analytics/onboardingReviewPack.ts`
  - `apps/web/src/lib/analytics/marketEntryReviewBoard.ts`
  - `apps/web/src/lib/analytics/weeklyProductAnalyticsDashboard.ts`

## Evidence source and confidence
- This review reuses the PR1-fixed weekly analytics artifacts already checked into the repo: the workflow docs, the weekly dashboard/export builders, and this decision-memo format.
- Current repository checkout still does **not** contain checked-in onboarding-review or market-entry event exports for either the active window (**2026-03-09 → 2026-03-16 UTC**) or the immediately previous window (**2026-03-02 → 2026-03-09 UTC**).
- The fixed-window dashboard/export pipeline was therefore run against the currently available in-environment event set for this checkout, which remains empty across both windows.
- Result: this memo is evidence-based about **readiness of the weekly review pipeline** and about the **absence of usable weekly cohort data in the current environment**, but it is **not** sufficient to justify product-severity or copy decisions for guardrails / preset recovery.

## Aggregate pack summary

### Onboarding aggregate
| Metric | Result |
|---|---:|
| Review sessions | 0 |
| Completed review sessions | 0 |
| Review → completed conversion | 0.0% |
| Review without completion sessions | 0 |
| Review without completion rate | 0.0% |
| Critical / warning / info shown | 0 / 0 / 0 |
| Confidence status | `needs_attention` |
| Confidence note | No onboarding review sessions were recorded in the weekly window. |

### Onboarding locale packs
| Locale | Review sessions | Review → completed conversion | Status |
|---|---:|---:|---|
| `en` | 0 | 0.0% | no support |
| `zh-HK` | 0 | 0.0% | no support |

### Market-entry aggregate
| Metric | Result |
|---|---:|
| Landing views | 0 |
| Sample journey impressions | 0 |
| Journey CTA clicks | 0 |
| Preset create started | 0 |
| Preset create submitted | 0 |
| Case created | 0 |
| Onboarding started | 0 |
| Onboarding completed | 0 |
| Signed-in completion rate | 0.0% |
| Signed-out completion rate | 0.0% |
| Signed-in vs signed-out delta | n/a |
| Review-board decision | `hold` |

### Market-entry cohort retention
The board kept the required cohort dimensions available, but all were empty for this window:
- signed-in / signed-out
- journey
- preset
- journey ↔ preset pair
- experiment slot / variant

## Fixed priority guardrail check

### Decision rule applied
- Weekly review sessions `< 20` => directional only.
- Rule shown support `< 5` => observation only.

### Window comparison basis
| Window | Review sessions | Completed review sessions | Review → completed conversion | Confidence |
|---|---:|---:|---:|---|
| Current: `2026-03-09 → 2026-03-16 UTC` | 0 | 0 | 0.0% | no support |
| Previous: `2026-03-02 → 2026-03-09 UTC` | 0 | 0 | 0.0% | no support |

### Current vs previous window by priority rule
| Guardrail | Current show rate | Previous show rate | Show-rate trend | Current fix-success | Previous fix-success | Fix-success trend | Current review → completed conversion* | Previous review → completed conversion* | Conversion trend | Classification | Reason |
|---|---:|---:|---|---:|---:|---|---:|---:|---|---|---|
| `property_usage_missing` | 0.0% (0/0) | 0.0% (0/0) | flat / no support | 0.0% (0/0) | 0.0% (0/0) | flat / no support | 0.0% | 0.0% | flat / no support | observation only | Weekly review sessions = 0 and shown support = 0 across both windows. |
| `duplicate_current_home_housing_costs` | 0.0% (0/0) | 0.0% (0/0) | flat / no support | 0.0% (0/0) | 0.0% (0/0) | flat / no support | 0.0% | 0.0% | flat / no support | observation only | Weekly review sessions = 0 and shown support = 0 across both windows. |
| `duplicate_rent_expense_inputs` | 0.0% (0/0) | 0.0% (0/0) | flat / no support | 0.0% (0/0) | 0.0% (0/0) | flat / no support | 0.0% | 0.0% | flat / no support | observation only | Weekly review sessions = 0 and shown support = 0 across both windows. |
| `mortgage_property_basics_missing` | 0.0% (0/0) | 0.0% (0/0) | flat / no support | 0.0% (0/0) | 0.0% (0/0) | flat / no support | 0.0% | 0.0% | flat / no support | observation only | Weekly review sessions = 0 and shown support = 0 across both windows. |

\* `review → completed conversion` is a weekly window metric shared by all four rule reviews; it is repeated here so each rule row keeps the three required decision metrics together.

## App preset recovery confusion cross-check

### Surfaces checked
- onboarding start / resume
- overview recovery banner
- settings data-management recovery

### Finding
- No weekly analytics evidence was available in this environment to show whether users confused these preset-recovery surfaces with Plan Lab templates or Money event-create flows.
- The market-entry board also had no signed-in / signed-out, journey / preset, or experiment-slot cohort traffic in either the current or previous fixed window, so there is no adjacent cohort signal to support or refute confusion.
- Tagged qualitative beta feedback for the three source surfaces was also absent from the PR1-fixed artifacts available in this checkout.

### Decision
- **Classification: observation only**
- **Reason:** no weekly support in either comparison window, and the qualitative beta-feedback signal requested by the workflow was not available inside the checked-in analytics evidence for this repository checkout.

## Decision log: action vs observation
| Item | Classification | Decision | Why |
|---|---|---|---|
| Change any of the four priority guardrail severities | observation only | Do not change severity based on this window. | Review sessions `< 20`; each rule shown support `< 5`. |
| Ship new guardrail copy / action-hint tuning from this window alone | observation only | Do not promote this comparison into product policy. | No usable weekly review evidence exists in either compared window. |
| Treat preset-recovery confusion as a proven product issue | observation only | Keep as beta watch item only. | No cohort evidence and no tagged beta feedback in either compared window. |
| Keep the weekly Monday → Monday UTC ritual and export aggregate + locale packs | actionable | Continue as operating baseline. | The pipeline generated the correct fixed window and explicit no-data statuses. |
| Require the next review to use exported real event data from the debug board or equivalent internal export | actionable | Make real weekly exports a prerequisite for roadmap reprioritization. | Current evidence gap is now explicit and measurable. |

## Recommendation for next weekly run
1. Export real onboarding-review and market-entry event payloads for the next full Monday → Monday UTC window from the internal debug board / approved internal export path.
2. Re-run aggregate + locale packs before discussing copy or severity changes.
3. Keep the four fixed guardrails as the first review slice.
4. Add/collect qualitative beta feedback tagged by source surface (`onboarding_start_resume`, `overview_recovery_banner`, `settings_data_management_recovery`) so preset confusion can be cross-checked without overloading analytics payloads.

## Bottom line
- **This week does not justify a new product decision.**
- The only strong conclusion is operational: the weekly review framework is in place, but this environment still lacks real weekly evidence for onboarding guardrail calibration, market-entry publishability review, and preset-recovery confusion assessment.
