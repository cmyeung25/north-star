# Onboarding Guardrail Analytics Review Pack v1

Last updated: 2026-03-20

## Purpose

This review pack turns onboarding guardrail funnel events into a weekly calibration ritual for PM/UX.

It is intentionally limited to metadata-only analytics so the team can review blocker quality without collecting financial payloads or writing cross-scenario fix state.

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

## Weekly review: the 5 numbers PM/UX must read

Review at least once per week and always segment by `locale` first if sample size is meaningful.

### 1) Review → completed conversion

Formula:

- distinct `reviewSessionId` with `onboarding_completed`
  ÷ distinct `reviewSessionId` with `onboarding_review_viewed`

Use it to answer:

- Are users getting through the review step at all?
- Did a copy/rule change improve completion after review?

### 2) Top 3 guardrails by show rate

Formula:

- count of `guardrail_shown` grouped by `guardrailId`

Use it to answer:

- Which rules dominate the review experience?
- Are we over-concentrating the review screen on one or two issues?

### 3) Top 3 guardrails by lowest fix success rate

Formula:

- distinct `reviewSessionId` with `guardrail_fixed` for a `guardrailId`
  ÷ distinct `reviewSessionId` with `guardrail_shown` for that same `guardrailId`

Use it to answer:

- Which rules users see but rarely resolve?
- Which rules may need copy, severity, or target-step clarification?

### 4) Top 3 guardrails most associated with review-without-complete

Formula:

- count of `guardrail_shown` grouped by `guardrailId`
  where that `reviewSessionId` has `onboarding_review_viewed`
  and no `onboarding_completed`

Use it to answer:

- Which rules most often appear in reviews that do not finish?
- Are some guardrails causing drop-off even if they are not the highest-volume rules?

### 5) Severity mix

Formula:

- aggregate `criticalGuardrailCount`, `warningGuardrailCount`, `infoGuardrailCount`
  from `onboarding_review_viewed`

Use it to answer:

- Is `critical` too heavy relative to the current beta population?
- Did a calibration change simply move volume from `critical` to `warning`, or truly reduce friction?

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

## Suggested weekly review cadence

1. Pull the five metrics above for the last full week.
2. Compare against the previous two weekly windows.
3. Pick at most three guardrails for action.
4. For each selected rule, decide one action only:
   - keep
   - copy rewrite
   - severity downgrade
   - temporary pause
5. Record the decision in product notes before shipping the next calibration pass.

## Recommended output format for PM/UX

- Review → completed conversion:
- Top shown guardrails:
- Lowest fix-success guardrails:
- Review-without-complete guardrails:
- Severity mix:
- Actions this week:
- Risks / caveats:
