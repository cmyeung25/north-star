# Onboarding Guardrail Weekly Review Workflow
Last updated: 2026-03-21

## Goal
- Turn the existing metadata-only `onboardingReviewPack` into a fixed weekly operating ritual instead of an ad-hoc export.
- Keep the workflow safe for different household personas and acquisition cohorts: we should reduce friction without overfitting to one locale, one preset, or one sample journey.
- Prioritize copy, action hint, and target-step clarity before adding more rules or reclassifying severity.

## Source of truth
Use these two artifacts together:

1. `docs/product/ONBOARDING_GUARDRAIL_ANALYTICS_REVIEW_PACK.md`
2. `apps/web/src/lib/analytics/onboardingReviewPack.ts`

The review workflow must remain metadata-only and only consume the existing onboarding funnel contract:
- `onboarding_review_viewed`
- `guardrail_shown`
- `guardrail_fixed`
- `onboarding_completed`

Allowed payload remains restricted to:
- `locale`
- `reviewSessionId`
- `reviewSourceContext`
- review/completeness/guardrail levels
- guardrail counts
- `guardrailId`
- `guardrailCategory`
- `guardrailSeverity`
- `targetStepId`
- `targetSection`

## Fixed weekly cadence

### Timing
- Review window: previous full Monday → Monday UTC window.
- Operating review: every Tuesday.
- Fast follow: by Wednesday end of day, assign copy / IA / target-step fixes if a focus rule is high-friction with enough support.
- Escalation: severity review is only allowed after at least one more full weekly window still shows baseline-correctness risk after copy / target clarity changes.

### Owner set
- PM owner: decision and prioritization.
- UX owner: copy, action-hint, and target-step clarity.
- Engineering owner: event integrity, export integrity, and payload allowlist enforcement.

## Weekly execution steps

### 1) Export the last full week
Use the helper window and build one aggregate pack plus locale splits.

Expected outputs:
- review → completed conversion
- top shown guardrails
- lowest fix-success guardrails
- review-without-completion candidates
- severity mix

### 2) Inspect the four priority rules first
Current focus list:
- `property_usage_missing`
- `duplicate_current_home_housing_costs`
- `duplicate_rent_expense_inputs`
- `mortgage_property_basics_missing`

Why these go first:
- They are currently the strongest combination of high show-rate and/or low fix-success risk.
- They are also the rules most likely to confuse a first-time household user about where to go next.

### 3) Run confidence and bias checks before any product decision
Minimum checks:
- **Review sample size**: under 20 review sessions in the weekly window = directional only.
- **Rule support**: under 5 shown review sessions for a guardrail = observation only.
- **Locale skew**: if one locale exceeds 70% of review sessions, read aggregate rankings as cohort-specific.
- **Persona / preset / journey distortion**: onboarding review events do **not** contain these fields by design. Cross-check the same week against the market-entry review board before calling a rule a product problem.

Decision constraint:
- If support is below threshold, record the observation but do **not** escalate it into severity or roadmap policy.

## Default action ladder

### Step A — first preference: rewrite copy
If a focus rule is common and users rarely resolve it, first improve:
- why the system is warning
- what baseline risk or ambiguity it is trying to prevent
- what “good” looks like in plain language

### Step B — second preference: clarify action hint and target section
If the user likely understands the warning but does not know where to fix it:
- make `targetStepId` / `targetSection` clearer
- reduce “which step do I go back to?” hesitation
- keep routing and component severity logic unchanged

### Step C — third preference: review severity only when baseline correctness stays at risk
Severity review is allowed only when:
- the rule still blocks or distorts baseline correctness after copy / target clarity fixes
- support is large enough to be trustworthy
- locale / persona / preset skew has been checked and documented

Do **not** move business severity logic into the component.

## Weekly review board template

### Section A — Window and confidence
- window start / end
- total review sessions
- completed review sessions
- review → completed conversion
- sample-size status
- locale-skew status
- persona/preset/journey check status

### Section B — Priority rules
For each focus rule capture:
- shown review count
- shown rate
- fixed review count
- fix-success rate
- incomplete review count
- incomplete share of shown
- support label: `enough_support` or `observation_only`
- default recommendation:
  - `monitor`
  - `rewrite_copy_and_action_hint`
  - `clarify_target_step_and_section`
  - `consider_severity_review_if_baseline_risk_persists`
  - `observation_only_sample_too_small`

### Section C — Product decision
Allowed outcomes:
- `observe only`
- `copy / action-hint update`
- `target-step / section clarity update`
- `severity review candidate for next week only`

### Section D — Readiness note
- Did this week reduce blocker confidence?
- Is onboarding review friction still a closed-beta blocker?
- What needs another full-week validation window?

## Current interpretation policy for the four focus rules
- `property_usage_missing`: treat as high-visibility path-selection friction; prioritize copy and next-step clarity first.
- `duplicate_current_home_housing_costs`: keep as non-blocking reminder; only revisit severity if it repeatedly correlates with incorrect baseline outcomes after copy improvements.
- `duplicate_rent_expense_inputs`: treat as duplicate-input ambiguity; prioritize human-language explanation and clearer return target.
- `mortgage_property_basics_missing`: treat as structural linkage confusion; prefer clearer property-details guidance before changing severity.

## Readiness / blocker rule
Update `docs/product/IMPLEMENTATION_STATUS.md` every week with:
- latest weekly-window finding
- whether current blocker confidence increased or decreased
- whether readiness changed because evidence is now strong enough or still only directional

If the weekly pack is below confidence thresholds, record:
- what was observed
- why it is still low-confidence
- what additional week or cohort evidence is required
