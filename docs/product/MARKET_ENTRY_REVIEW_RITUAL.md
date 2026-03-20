# Market Entry Review Ritual
Last updated: 2026-03-20

## Why this ritual exists
- Public sample journeys are only publishable if PM / UX can see whether the promise on the landing page survives the full handoff into member create and onboarding.
- This ritual turns the market-entry funnel into a weekly operating review with one vendor-agnostic contract and one publishability decision rule.
- Target users remain different household personas with different urgency, confidence, and financial literacy levels. Review decisions must therefore protect user trust, not just maximize top-line clicks.

## Event contract scope
Use only the market-entry metadata-safe contract:

- `market_landing_view`
- `sample_journey_impression`
- `journey_cta_click`
- `auth_modal_open`
- `case_created`
- `preset_create_started`
- `preset_create_submitted`
- `onboarding_started`
- `onboarding_completed`

Allowed payload keys only:

- `locale`
- `journeyId`
- `presetId`
- `isSignedIn`

Never add:

- money amounts
- asset values
- case ids / scenario ids
- lifecycle shortcuts that imply onboarding completion without the real flow

## Weekly review cadence

### Cadence
- Review window: previous full Monday-Sunday week.
- Primary review: every Tuesday morning, product + UX + engineering together.
- Fast follow: by Wednesday end of day, assign copy / IA / handoff fixes if any KPI is below threshold.
- Escalation review: same week if a journey drops below minimum sample size-adjusted publishability threshold for two consecutive weeks.

### Required attendees
- PM owner for market entry
- UX owner for landing + create-flow handoff
- Engineering owner for funnel instrumentation / routing contract
- Optional: growth / operations if traffic mix changed materially

## Core KPI formulas

### 1) Landing → Journey CTA CTR
Formula:

`journey_cta_click / market_landing_view`

Why it matters:
- Tells us whether the public promise is understandable enough for a household to pick a path.

### 2) Sample journey card CTR
Formula:

`journey_cta_click / sample_journey_impression`

Why it matters:
- Separates section/card effectiveness from total landing traffic noise.
- Use for sample-journey publishability decisions before spending more traffic.

### 3) Journey CTA → Preset start rate
Formula:

`preset_create_started / journey_cta_click`

Why it matters:
- Validates whether the `journey + preset` handoff still lands cleanly in `/member/cases` and opens the intended create path without confusion.

### 4) Preset start → Case created conversion
Formula:

`case_created / preset_create_started`

Why it matters:
- Measures whether the member create flow is simple enough for users who already expressed intent.

### 5) Preset submit → Onboarding start rate
Formula:

`onboarding_started / preset_create_submitted`

Why it matters:
- Detects create-flow friction right before onboarding begins.

### 6) Case created → Onboarding completed gap
Formula:

`onboarding_completed rate - case_created rate` is **not** the metric.

Use:

`case_created → onboarding_completed drop = 1 - (onboarding_completed / case_created)`

or, in percentage-point review language:

`case_created rate - onboarding_completed rate`

Why it matters:
- Protects against a misleading “successful create” milestone where many users abandon immediately after case creation.

### 7) Signed-in vs signed-out handoff delta
Formula:

For each key conversion step, compare:

`conversion when isSignedIn=true` vs `conversion when isSignedIn=false`

Why it matters:
- Signed-out users must still return to `/{locale}/member/cases` after auth with the same sanitized entry intent. A large delta usually means the auth return path or promise continuity is weak.

## Required cohort breakdowns
Every weekly review must show each KPI by:

### 1) Persona / journey
- `officeSaver`
- `coupleHome`
- `newParents`
- `mortgageOwner`

### 2) Preset
- `single-renter`
- `dual-income-home`
- `dual-income-rental`
- `new-baby`
- `new-baby-helper`
- `high-asset`

### 3) Locale
- At minimum: `en`, `zh-HK`

### 4) Signed-in state
- `isSignedIn=true`
- `isSignedIn=false`

### 5) Journey ↔ preset pair
- Review the actual pair, not just journey totals, so persona promise mismatch is visible.

## Minimum sample-size warnings

### Warning bands
- **Under 30 journey CTA clicks per cohort/week:** directional only; do not ship big copy changes based on this alone.
- **Under 50 sample journey impressions per cohort/week:** impression-based CTR is too noisy for publishability decisions.
- **Under 20 case-created events per cohort/week:** do not interpret onboarding completion gaps as stable.
- **Single-locale skew > 70% of weekly traffic:** note that cohort results may be locale-biased.

### Interpretation guardrails
- Never compare cohorts with materially different sample sizes without labeling the weaker cohort as low-confidence.
- Never declare one persona “weak” if the sample is below the warning threshold and traffic mix shifted that week.
- If signed-out traffic share changes sharply, annotate auth-handoff metrics before changing journey copy.

## Ready-to-scale-traffic rule
Sample journeys are **ready to scale traffic** only when all conditions below hold for two consecutive weekly windows:

1. Landing → Journey CTA CTR is at or above the roadmap minimum.
2. Sample journey card CTR is stable or improving for the target cohort.
3. Journey CTA → Preset start rate shows no major signed-in / signed-out break.
4. Preset start → Case created conversion is healthy enough that users are not stalling in member create.
5. Case created → Onboarding completed drop stays below the roadmap guardrail.
6. No cohort shows a severe localized failure hidden by aggregate totals.
7. Instrumentation is complete for the reviewed path, with no known routing regressions or shortcut flows.

## Not ready to scale if any of these are true
- The path bypasses `/{locale}/member/cases`.
- Unknown `journey` / `preset` values are not sanitizing back to blank flow.
- A journey can create or imply a completed scenario directly.
- Sample journey cards are receiving impressions but not reliable click or case-created measurement.
- One persona cohort is materially below threshold but aggregate totals still look acceptable.

## Weekly review board template

### Section A — Executive summary
- Total landing views
- Total sample journey impressions
- Total journey CTA clicks
- Total case created
- Total onboarding started
- Total onboarding completed

### Section B — KPI table
- CTR / CVR values for the seven core formulas above
- Compare vs prior week
- Flag below-threshold metrics

### Section C — Cohort breakdown
- persona / journey
- preset
- locale
- signed-in state
- journey ↔ preset pair

### Section D — Interpretation notes
- traffic mix change?
- auth flow incident?
- locale mix skew?
- copy or IA experiment running?

### Section E — Decision
One of:
- `hold`
- `fix before scale`
- `ready to scale traffic`

## Ownership
- PM owns the publishability decision.
- UX owns copy / journey-message / handoff clarity interpretation.
- Engineering owns event integrity, routing-contract compliance, and payload guardrails.

## Architecture guardrails
- The only public-entry handoff remains `/{locale}/member/cases?journey={journeyId}&preset={presetId}`.
- Query intent may initialize member create only.
- No direct scenario creation shortcut.
- No onboarding completion shortcut.
- No financial business payload in market-entry analytics.
