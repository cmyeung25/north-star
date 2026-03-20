# Onboarding Guardrail Analytics Review Pack v1

Last updated: 2026-03-20

## Purpose

This review pack turns onboarding guardrail funnel events into a weekly calibration ritual for PM/UX/operators.

It is intentionally limited to metadata-only analytics so the team can review blocker quality without collecting financial payloads or writing cross-scenario fix state.

The implementation path is now:

1. Pull a weekly slice of onboarding funnel events.
2. Filter to the target locale (or review all locales first, then split).
3. Feed the event array into the internal review-pack builder.
4. Export the resulting summary/tables into a simple JSON/table view for the weekly ritual.

## Event contract guardrails

Allowed event family:

- `onboarding_review_viewed`
- `guardrail_shown`
- `guardrail_fixed`
- `onboarding_completed`

Allowed payload fields only:

- `locale`
- `flowVersion`
- `reviewStepId`
- `reviewSessionId`
- `reviewSourceContext`
- `completenessLevel`
- `completenessScorePct`
- `guardrailLevel`
- `guardrailCount`
- `criticalGuardrailCount`
- `warningGuardrailCount`
- `infoGuardrailCount`
- `guardrailId`
- `guardrailSeverity`
- `guardrailCategory`
- `targetStepId`
- `targetSection`

Never add:

- money amounts
- income / expense values
- asset values
- scenario payload snapshots
- case/scenario identifiers
- persistent fix-progress state

## Stable event semantics

### `guardrail_fixed`

Count a guardrail as fixed only when all of the following are true:

1. The user clicked a fix CTA from the review step.
2. The user returned to a later review pass.
3. The same guardrail id no longer exists in that later review pass.

Do **not** count as fixed when:

- the user only navigates away and never returns to review
- the same review pass re-renders
- temporary UI state changes remove a row before the next review pass
- the product would need cross-scenario persistence to infer progress

## Exact weekly inputs

Use **only** the four existing onboarding funnel events inside one review window:

- `onboarding_review_viewed`
- `guardrail_shown`
- `guardrail_fixed`
- `onboarding_completed`

Required input fields per event family:

| Event | Required fields for weekly pack |
|---|---|
| `onboarding_review_viewed` | `ts`, `locale`, `reviewSessionId`, `reviewSourceContext`, `guardrailCount`, `criticalGuardrailCount`, `warningGuardrailCount`, `infoGuardrailCount` |
| `guardrail_shown` | `ts`, `locale`, `reviewSessionId`, `guardrailId`, `guardrailSeverity`, `guardrailCategory`, `targetStepId`, `targetSection` |
| `guardrail_fixed` | `ts`, `locale`, `reviewSessionId`, `guardrailId`, `guardrailSeverity`, `guardrailCategory`, `targetStepId`, `targetSection` |
| `onboarding_completed` | `ts`, `locale`, `reviewSessionId` |

Weekly window rules:

- default cadence: last full Monday→Monday or Sunday→Sunday window, but keep the same boundary every week
- filter by `ts >= weekStart` and `ts < weekEnd`
- review `locale` separately when sample size is meaningful
- only count `onboarding_completed` / `guardrail_shown` / `guardrail_fixed` rows whose `reviewSessionId` also has an `onboarding_review_viewed` inside the same window

## Weekly review: the 5 numbers PM/UX must read

Review at least once per week and always segment by `locale` first if sample size is meaningful.

### 1) Review → completed conversion

Exact ratio:

- distinct review sessions with both `onboarding_review_viewed` and `onboarding_completed`
  ÷ distinct review sessions with `onboarding_review_viewed`

Use it to answer:

- Are users getting through the review step at all?
- Did a copy/rule change improve completion after review?

### 2) Top shown guardrails

Exact ratio:

- distinct review sessions with `guardrail_shown` for a given `guardrailId`
  ÷ distinct review sessions with `onboarding_review_viewed`

Also show the raw support numbers:

- `shownReviewCount`
- `shownEventCount`

Use it to answer:

- Which rules dominate the review experience?
- Are we over-concentrating the review screen on one or two issues?

### 3) Lowest fix-success guardrails

Exact ratio:

- distinct review sessions with `guardrail_fixed` for a `guardrailId`
  ÷ distinct review sessions with `guardrail_shown` for that same `guardrailId`

Use it to answer:

- Which rules users see but rarely resolve?
- Which rules may need copy, severity, or target-step clarification?

### 4) Review-without-completion candidates

Exact ratio:

- distinct shown review sessions for a `guardrailId` that do **not** have `onboarding_completed`
  ÷ distinct shown review sessions for that same `guardrailId`

Also show the raw support number:

- `incompleteReviewCount`

Use it to answer:

- Which rules most often appear in reviews that do not finish?
- Are some guardrails causing drop-off even if they are not the highest-volume rules?

### 5) Severity mix

Exact totals:

- sum `criticalGuardrailCount` from `onboarding_review_viewed`
- sum `warningGuardrailCount` from `onboarding_review_viewed`
- sum `infoGuardrailCount` from `onboarding_review_viewed`
- optional operator helper: `averageGuardrailsPerReview = sum(guardrailCount) ÷ reviewSessionCount`

Use it to answer:

- Is `critical` too heavy relative to the current beta population?
- Did a calibration change simply move volume from `critical` to `warning`, or truly reduce friction?

## Interpretation rubric

### Read in this order

1. **Review volume first** — do we have enough sessions this week?
2. **Locale / cohort split second** — is the signal concentrated in one locale or acquisition mix?
3. **Top shown guardrails third** — which rules dominate attention?
4. **Fix-success fourth** — are users actually resolving them?
5. **Review-without-completion fifth** — which rules appear most in unfinished reviews?

### Working rubric

| Signal pattern | Likely interpretation | Default action |
|---|---|---|
| High shown rate + high fix success | Rule is common but understandable/actionable | Keep; monitor copy only |
| High shown rate + low fix success + high review-without-completion | Rule may be noisy, too severe, or hard to act on | Review severity/copy first |
| Medium shown rate + medium fix success + repeated unfinished reviews | Users probably try to fix it but do not understand the expected input | Rewrite copy / target-step hint |
| Low shown rate + bad percentages + tiny sample | Likely unstable signal | Do not change the product yet |
| High critical mix across all reviews | Beta population or preset mix may genuinely be low-quality, or rules may be too strict | Check persona/preset bias before changing severity |

## How to decide whether to downgrade, rewrite, or pause a rule

### Consider downgrading severity when:

- show rate is high
- fix success rate is low
- review-without-complete association is high
- but manual review shows the rule is often cautionary rather than baseline-breaking

Typical action:

- `critical` → `warning`
- or `warning` → `info`

### Consider rewriting copy when:

- show rate is high
- fix success is middling rather than near-zero
- users appear to try to fix it but still come back with the same rule

Typical action:

- clarify the reason
- make the target step/section more explicit
- say what “good” looks like in simpler language

### Consider pausing a rule when:

- show rate is high
- fix success is very low
- review drop-off association is high
- and qualitative review suggests the rule is noisy, ambiguous, or not actionable in beta

Typical action:

- temporarily remove the rule from the review funnel
- keep the product note so it can return after semantics/copy are improved

## What not to misread as a product problem

**Important:** high show rate != product bug until persona mix, preset mix, locale bias, and sample size have been checked.

Do not immediately treat these as product defects:

- high volume from a single locale during a campaign or persona-heavy cohort
- a rule with high show rate but also high fix success rate
- a low-volume rule with bad percentages but tiny sample size
- a rule that drops after preset/seed distribution changes rather than UX changes
- a review session without completion when the user intentionally leaves before submit

Always check:

- sample size
- locale split
- persona / journey acquisition context if available elsewhere
- whether the rule is expected for a specific preset mix that week

Recommended minimum sanity checks before actioning a rule:

- fewer than 20 review sessions in the segment: treat as directional only
- fewer than 5 shown review sessions for a rule: do not recalibrate severity from this number alone
- sudden spike from one persona / sample journey: verify acquisition mix before changing product semantics

## Suggested weekly review cadence

1. Pull the last full week using stable `weekStart` / `weekEnd`.
2. Build/export one pack for `all` locales, then split by locale when sample size supports it.
3. Compare against the previous two weekly windows.
4. Pick at most three guardrails for action.
5. For each selected rule, decide one action only:
   - keep
   - copy rewrite
   - severity downgrade
   - temporary pause
6. Record the decision in product notes before shipping the next calibration pass.

## Recommended output shape for PM/UX / operator

Weekly summary:

- `reviewSessions`
- `completedReviewSessions`
- `reviewToCompletedConversionPct`
- `reviewWithoutCompletionSessions`
- `reviewWithoutCompletionPct`
- `criticalGuardrailsShown`
- `warningGuardrailsShown`
- `infoGuardrailsShown`
- `totalGuardrailsShown`
- `averageGuardrailsPerReview`
- `initialReviewSessions`
- `returnedFromFixSessions`

Weekly tables:

- `topShownGuardrails`
- `lowestFixSuccessGuardrails`
- `reviewWithoutCompletionCandidates`

Each table row should carry:

- `guardrailId`
- `severity`
- `category`
- `targetStepId`
- `targetSection`
- `shownEventCount`
- `shownReviewCount`
- `shownRatePct`
- `fixedReviewCount`
- `fixSuccessRatePct`
- `reviewWithoutCompletionCount`
- `reviewWithoutCompletionPct`

## PM/UX meeting template

- Review → completed conversion:
- Top shown guardrails:
- Lowest fix-success guardrails:
- Review-without-complete guardrails:
- Severity mix:
- Actions this week:
- Risks / caveats:
