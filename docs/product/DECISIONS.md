# North Star Product Decisions

Last updated: 2026-03-21

## Decision Log

### D-2026-03-21-05
- Date: 2026-03-21
- Status: Accepted
- Context: The onboarding guardrail analytics review pack was operator-ready, but PM/UX still lacked one fixed weekly workflow for choosing the window, checking confidence, and deciding whether a high-friction rule should trigger copy work, target-step clarification, or only observation.
- Decision: Formalize a fixed weekly onboarding guardrail review workflow on top of `onboardingReviewPack`. The workflow now uses the previous full Monday→Monday UTC week by default, always exports aggregate + locale packs, keeps a fixed four-rule priority list (`property_usage_missing`, `duplicate_current_home_housing_costs`, `duplicate_rent_expense_inputs`, `mortgage_property_basics_missing`), and applies confidence checks before any product action: under 20 weekly review sessions => directional only, under 5 shown review sessions per rule => observation only, locale skew above 70% => annotate as cohort-specific. Persona / preset / journey bias must be reviewed through the separate market-entry board because onboarding analytics intentionally exclude those fields.
- Guardrails: Keep the payload metadata-only and do not add persona / preset / journey ids into onboarding review events. Default remediation order is copy → action hint / target section clarity → severity review only if baseline-correctness risk persists after another full window; do not move business severity logic into review components.

### D-2026-03-21-04
- Date: 2026-03-21
- Status: Accepted
- Context: The app-internal preset extension contract already reserved scenario settings → data management reset as the third recovery surface, but without an implementation the recovery mental model still looked incomplete and future agents could easily drift toward putting preset entry points into Money / Plan Lab or baseline drawers instead.
- Decision: Ship the third app preset recovery entry only inside scenario settings → Data Management, using the existing six-seed allowlist, shared onboarding journey-summary presenter, and the same `replaceActiveScenarioOnboardingDraftPresetState` write path that only creates or replaces the active scenario’s onboarding draft starting point before routing back to onboarding. Keep settings copy intentionally shorter than onboarding/dashboard recovery: use restart / replace draft wording, show overwrite warning only when a draft already exists, and never frame it like a marketing CTA or experiment template.
- Guardrails: Extend source-guard coverage so the settings recovery helper also stays out of Plan Lab Add Experiment, Money add-event / template pickers, and baseline event create/edit drawers. Do not add settings-specific preset ids, direct baseline writes, onboarding-complete shortcuts, or cross-scenario state.

### D-2026-03-21-03
- Date: 2026-03-21
- Status: Accepted
- Context: Dashboard / overview can only serve active scenarios, so the second app-internal preset surface needed a recovery-specific trigger and copy model that still reuses entry 1’s allowlist, journey guidance, and onboarding-draft write path without inventing a separate app-only preset system.
- Decision: Ship overview/dashboard recovery as a banner + preset-suggestion surface that appears only when the active scenario is already routable to dashboard **and** still shows onboarding recovery gaps in baseline setup signals. The banner copy must explicitly state that the action only replaces the active scenario’s scenario-scoped onboarding draft starting point, does not complete the scenario, does not write baseline events directly, and immediately returns the user to onboarding for confirmation. Preset cards continue to reuse the same allowlisted seeds, shared journey-summary presenter, and existing onboarding draft replacement path from entry 1.
- Guardrails: Do not add dashboard-specific preset allowlists, analytics payloads, or direct baseline writes. Keep Plan Lab / Money / baseline event drawers free of both onboarding and dashboard recovery preset helpers via source-guard tests, and leave the future settings reset surface on the shorter reset/restart copy path already documented.

### D-2026-03-21-02
- Date: 2026-03-21
- Status: Accepted
- Context: The onboarding preset suggestion beta surface already existed, but its card copy was still thinner than the member create dialog and lacked an explicit “replace current draft” warning when an active scenario already had onboarding draft state. That created mental-model drift between member entry and app recovery entry, especially for personas that may encounter the same preset in both places.
- Decision: Treat app preset suggestions as setup/recovery guidance, not template-picking. Reuse a shared summary presenter/view-model so member create and onboarding start/resume both render the same four-step summary structure (`audience` → `starting context` → `ETA` → `outcome`). On app recovery surfaces, only show replace warning / replace CTA when an onboarding draft already exists, and always restate that the action means **re-choosing the active scenario’s onboarding draft starting point**—never writing baseline data directly and never marking onboarding complete.
- Guardrails: Keep the copy rule scoped to active-scenario onboarding draft actions only; do not move preset suggestions into Plan Lab, Money, or baseline event drawers. Dashboard recovery should reuse the same setup/recovery summary structure later, while scenario settings reset must stay shorter and more guarded so it is not mistaken for a normal edit shortcut.

### D-2026-03-21-01
- Date: 2026-03-21
- Status: Accepted
- Context: PM requested an inventory of the current preset entry contract and a UX / IA definition for which app-internal pages may later reuse the same onboarding-prefill mental model, without weakening the existing `/member/cases` landing rule or blurring the boundary with Plan Lab / Money creation flows.
- Decision: Keep `/{locale}/member/cases` create dialog as the only productized preset entry. Define app-internal preset suggestions as a beta-only extension contract limited to three active-scenario setup / recovery surfaces: (1) scenario onboarding start / resume shell for not-yet-onboarded scenarios, (2) overview/dashboard onboarding-incomplete recovery banner, and (3) scenario settings data-management reset action. In every case, preset means “create or replace the active scenario’s scenario-scoped onboarding draft starting point, then continue through onboarding”; it never means direct baseline write, onboarding-complete shortcut, or post-auth landing change.
- Guardrails: Do not surface preset suggestions inside Plan Lab Add Experiment, Money add-event/template pickers, or baseline event create/edit drawers. Onboarding start / dashboard recovery may include journey guidance + ETA + outcome copy because the user is choosing a starting path; settings reset must use shorter replace/restart copy plus overwrite warning so it is not mistaken for a normal edit shortcut. Future beta implementations must stay active-scenario-scoped and preserve the same analytics / routing / persistence boundaries already documented for member create flow.

### D-2026-03-20-13
- Date: 2026-03-20
- Status: Accepted
- Context: The onboarding review pack is now operator-ready, so the next calibration step is no longer “add more rules” but “reduce friction on the rules that show up often and resolve poorly.” The current-home duplicate path warning was still likely to appear frequently while being ambiguous to fix in one hop.
- Decision: Apply weekly calibration policy v1.2 for high-friction onboarding guardrails. Keep blocking `critical` reserved for true baseline-distortion conflicts only, downgrade `duplicate_current_home_housing_costs` from `warning` to `info`, and prioritize copy/target-step clarity for high-show or low-fix-success rules (`property_usage_missing`, `duplicate_current_home_housing_costs`, `duplicate_rent_expense_inputs`, `mortgage_property_basics_missing`) before adding any new rule coverage.
- Guardrails: Do not add new analytics fields, persistence, engine/compiler dependencies, or cross-scenario state. Calibration changes must stay inside the existing scenario-scoped rules layer + locale/review UX copy, and all analytics must remain metadata-only so weekly review interpretation still depends on the documented review-pack rubric rather than product-side state machines.

### D-2026-03-20-10
- Date: 2026-03-20
- Status: Accepted
- Context: PR 4A 需要把 onboarding guardrail analytics review pack 從「只有事件 + 描述文件」提升到營運可直接拿來做 weekly calibration 的 execution-ready 工具，但仍不可引入 persistence、engine 依賴或跨 scenario/case 狀態。
- Decision: 新增 analytics-only review-pack builder / formatter：以既有 `onboarding_review_viewed`、`guardrail_shown`、`guardrail_fixed`、`onboarding_completed` 事件陣列直接輸出 weekly summary sections（review→completed conversion、top shown guardrails、lowest fix-success guardrails、review-without-completion candidates）與 table/JSON export shape，供 PM/UX / operator 每週檢視，不新增任何資料寫入路徑。
- Guardrails: 聚合必須只依賴 metadata allowlist 欄位與事件 timestamp/window，不可要求 scenarioId、caseId、金額、資產值或其他 business payload；formatter 只做 report/export 形狀整理，不可變成 analytics-driven product state machine 或 dashboard persistence contract。

### D-2026-03-20-11
- Date: 2026-03-20
- Status: Accepted
- Context: PR 4 要把 onboarding guardrail analytics 從「有事件」提升為可供 PM/UX 每週 calibration review 的工具，但不可把 analytics 變成產品 state machine、不可為追蹤 fix progress 新增跨 scenario persistence，也不可讓事件 payload 滑向財務內容。
- Decision: Onboarding funnel contract v1.1 只維持 metadata allowlist，並新增兩個安全欄位：`reviewSessionId`（單次 review pass 的暫時關聯鍵）與 `reviewSourceContext`（`initial_review` / `returned_from_fix`）。`guardrail_fixed` 只可在使用者由 review 按 fix CTA 離開、再回到下一個 review pass 且該 guardrail 已消失時觸發；事件需帶回原 guardrail 的 `id / severity / category / target step / section`，以支援 weekly calibration 的 top blockers、low-fix-success 與 review→completed 分析。
- Guardrails: payload 必須經 allowlist sanitize，嚴禁輸出 scenarioId、金額、資產值、收入/支出內容或其他 business payload；`reviewSessionId` 只屬前端暫時事件關聯鍵，不可持久化到 scenario/case；review pack 解讀必須提醒 PM/UX：高出現率不必然等於產品問題，需先排除特定 persona/sample size/既有輸入習慣造成的偏差。

### D-2026-03-20-12
- Date: 2026-03-20
- Status: Accepted
- Context: A focused calibration pass was requested for the highest-friction onboarding housing/property guardrails, but the team needed to preserve the existing guardrail contract, avoid moving business severity logic into `ReviewStep`, and keep the fix loop inside the active scenario onboarding flow only.
- Decision: Keep the existing severity policy unchanged (`critical` only for blocking baseline-distortion conflicts; `warning` / `info` for review-needed or heads-up cases), but recalibrate the user-facing layer in two narrower ways: (1) rewrite the targeted rule copy into plain language that explains the problem, why it affects the baseline, and the next step; (2) tighten the rule target section when the current fix destination is too vague (for example, property-state conflicts point to `Assets → Property details`, and duplicate current-home housing-cost checks point to `Expenses → Housing costs`).
- Guardrails: Do not add new persistence, analytics fields, engine/compiler behavior, or deep-link navigation state. `ReviewStep` may only increase visual emphasis between `critical` / `warning` / `info` using the existing severity value and existing `onFixGuardrail` contract; it must not infer new business severity rules in the component.

### D-2026-03-20-08
- Date: 2026-03-20
- Status: Accepted
- Context: PR 2B 只聚焦 onboarding review 的「返回修正」清晰度，目標是讓使用者在按 fix CTA 前已知會回到哪個 step/section、應修正哪類欄位，但不可改動既有 wizard navigation contract、analytics 語意或引入 deep-link state。
- Decision: Review step 每條 guardrail 必須同時顯示 target step、target section 與更具體的 action hint；fix CTA label 亦要改為 step-aware wording（例如返回資產／Go to Assets），但 `onFixGuardrail` 仍只接收 guardrail id，並由 `OnboardingV3Wizard` 透過 `stepIndexById` 回到既有 step。
- Guardrails: 不可新增 route/deep-link state、不可新增 persistent fix-state、不可改 analytics payload 或 scenario-scoped data flow；section/field copy 必須走 i18n key，避免把回修文案硬編進 component。

### D-2026-03-20-07
- Date: 2026-03-20
- Status: Accepted
- Context: PR 2A 只處理 onboarding v3 review step 的資訊架構 / 視覺分組，目標是讓使用者在提交前更容易分辨「必須先修正」與「只是提醒」，但不可改動 fix-loop、analytics 或把 severity 商業判斷散落到 component。
- Decision: Review step guardrails 採 summary + grouped hierarchy 呈現：先顯示 completeness summary，再顯示 overall guardrail summary，之後依 `guardrailSummary.items[].severity` 原值分成 `critical / must fix`、`warning / review recommended`、`info / heads-up` 三段，無 guardrail 時顯示明確 clear state。component 只可依既有 severity 做分組與視覺層級，不可新增 rule-level business inference。
- Guardrails: 不可改 `onFixGuardrail` 流程、不可新增 analytics payload、不可新增導航契約或修正成功狀態；warning / info 的視覺語氣必須清楚低於 blocking critical，避免被誤解為阻止提交。

### D-2026-03-20-06
- Date: 2026-03-20
- Status: Accepted
- Context: PR-1 需要先在 onboarding v3 guardrails 的 rules layer 內重新校準 housing/property 警示強度，令 review UI 與 analytics 能分清「真正阻礙提交」vs「應提醒但不應過度施壓」的問題，同時不可把規則判斷散落到 UI component 或引入 engine 依賴。
- Decision: Onboarding v3 housing/property guardrails 採 severity calibration v1：只有會扭曲 baseline 核心語意、足以阻礙提交的規則保留 blocking `critical`（`mortgage_core_fields_missing`、`self_use_rental_conflict`）；`property_usage_missing`、`rental_property_income_missing`、`mortgage_property_basics_missing` 校準為 `warning`；duplicate 類 guardrails 採較輕量策略，其中 `duplicate_current_home_housing_costs` 維持 `warning`，`duplicate_rent_expense_inputs` 維持 `info`。guardrail summary level 亦以 blocking rule presence 決定是否為 `critical`，只有 info 類提醒時維持 `clear`。
- Guardrails: 校準只可發生在 onboarding v3 rules/summary layer；不可新增 persistence schema、不可寫入 scenario 外狀態、不可新增 engine/compiler 依賴、不可把 severity 判斷搬進 UI component。所有規則仍需維持 `id`、`severity`、`messageKey`、`actionHintKey`、`target step/section` 契約，供 review UI 與 analytics 共用。

### D-2026-03-20-05
- Date: 2026-03-20
- Status: Accepted
- Context: PR-4 需要把 onboarding v3 的 completeness / guardrails 從純規則輸出提升為真正可提交前理解、可回修、可量測的 review / submit 體驗，但不可把 analytics 變成收集財務內容的捷徑，也不可引入新的跨 scenario 狀態。
- Decision: Onboarding v3 review step 採「summary-first」結構：先顯示 completeness score + group summaries，再顯示 guardrail list 與 per-item fix CTA，所有返回修正都只跳回既有 wizard step。Analytics 採 vendor-agnostic `onboardingFunnel` client abstraction，僅記錄 funnel metadata（locale、completeness/guardrail level、counts、guardrail id/category/severity、target step/section），並補上 `onboarding_review_viewed`、`guardrail_shown`、`guardrail_fixed`、`onboarding_completed`。
- Guardrails: 不可發送任何金額、資產值、收入/支出內容或 scenario business payload；guardrail fix tracking 只代表「由 review 進入修正並在下一次 review 消失」，不可藉此寫入額外持久化狀態；submit feedback 僅屬 UI / transition 層，不改 compiler、engine、routing contract 或 scenario isolation。

### D-2026-03-20-04
- Date: 2026-03-20
- Status: Accepted
- Context: PR-3B 需要在不引入 engine 依賴、也不把修正文案硬編進 UI component 的前提下，為 onboarding review/資產步驟建立可持續演進的 guardrails 規則層；同時要先聚焦最常見的 housing/property 錯誤，避免一次塞入過多規則打擊完成率。
- Decision: Onboarding guardrails v1 採獨立 rules layer，輸入僅限 active onboarding draft + active scenario context，輸出 UI-consumable summary model；每條規則必須定義 `id`、`severity`、`messageKey`、`actionHintKey`、`target step/section`，並先覆蓋四類問題：`key_missing`、`obvious_conflict`、`basic_inconsistency`、`potential_double_counting`。首批 housing/property 規則包括：物業用途缺漏、按揭核心欄位缺漏、自住/出租衝突、出租物業租金缺漏、按揭與物業基本值不一致、以及住屋支出可能重複輸入。
- Guardrails: 規則層不可依賴 projection engine、不可跨 scenario 讀寫、不可直接持久化修正結果；UI 只消費 summary model。後續若擴充更多 guardrails，需以 beta 完成率與誤報率控制規則數量，避免過度警示。

### D-2026-03-20-03
- Date: 2026-03-20
- Status: Accepted
- Context: PR-3A 需要先把 onboarding completeness 從未來 guardrail 細則中拆成可獨立演進的總覽訊號，但不能讓這個分數依賴 projection engine，也不能因為 onboarding 預設建議值而誤判使用者已完成首次建模。
- Decision: Onboarding completeness score v1 採 5 個輸入群組（家庭結構、收入、固定支出、住屋資訊、資產 / 負債基本值）輸出 `ready / needs_attention / incomplete` summary model；資料來源僅限 active onboarding draft 與 active scenario context，並可重用 property-derived rules 補足 housing signal。自動建議薪資（auto salary suggestion）只計為 `needs_attention`，不可直接把整體狀態推到 `ready`。
- Guardrails: 此階段只做 score 規則層與 UI-consumable summary model，不加入 guardrail error list、analytics 或 engine 依賴；後續警示/修正引導須建立在同一份 scenario-scoped 規則輸出上。

### D-2026-03-20-02
- Date: 2026-03-20
- Status: Accepted
- Context: Onboarding housing/property UI copy had been clarified, but the migration path from onboarding draft / preset seed into v3 assets and scenario-draft compiler still had hidden semantic drift. In particular, custom `mortgageBaseValue` could change the effective down-payment basis, and zero-principal properties could still derive fake mortgage artifacts.
- Decision: Align housing semantic fallbacks across onboarding draft migration and scenario-draft compilation: `downPaymentPercent` always anchors to `propertyMarketValue`; `mortgagePrincipalOutstanding <= 0` is treated as no mortgage; positive `rentMonthly` may infer rental-property usage only as a backward-compatible fallback when `usage` is missing.
- Guardrails: This is an adapter/compiler mapping fix only. Do not change engine formulas, persistence schema, routing, or scenario scoping. Current-home rent remains an expense-path concept, while property rent remains owned-property income semantics.

### D-2026-03-20-01
- Date: 2026-03-20
- Status: Accepted
- Context: Onboarding v3 already had property/mortgage fields, but users still had to infer whether a field belonged to current-home rent, self-use property, rental property, or mortgage details. This created avoidable cognitive load in the very first baseline-building flow.
- Decision: In onboarding v3 assets step, first clarify that current-home rent belongs to Expense assumptions and that the assets step only captures owned property. Within owned property, UI should explicitly branch between self-use property vs rental property, then show mortgage fields only when mortgage is enabled. Review step should surface the chosen property/mortgage state so users can confirm the scenario before submit.
- Guardrails: This is a UI / i18n / review-summary IA change only; do not change engine/compiler behavior, persistence schema, scenario isolation, or post-login/member-to-app routing. Percentage fields that remain visible must include directionally clear helper copy.

### D-2026-03-07-01
- Date: 2026-03-07
- Status: Accepted
- Context: `docs/` 根目錄已有 roadmap/status 文件，但 AGENTS 規範要求 `docs/product/*` 為任務前後必讀/必更新路徑。
- Decision: `docs/product/*` 設為 canonical 產品文件路徑；root `docs/*` 同名文件僅保留導向用途。
- Guardrails: 所有後續任務以 `docs/product/ROADMAP.md`、`docs/product/IMPLEMENTATION_STATUS.md`、`docs/product/DECISIONS.md` 為唯一真實來源。

### D-2026-03-07-02
- Date: 2026-03-07
- Status: Accepted
- Context: 現階段需求偏向能力成熟度與上市條件，不適合過早綁定精確日期。
- Decision: Roadmap 採 phase-based（Closed Beta / Public MVP / Post-MVP Deferred）而非日期驅動。
- Guardrails: 每個 phase 必須包含完成定義、非範圍項與驗收條件。

### D-2026-03-07-03
- Date: 2026-03-07
- Status: Accepted
- Context: 單列技術任務無法反映 North Star 的市場化目標與上線風險。
- Decision: Roadmap 範圍包含產品功能 + 上市準備（入口導流、示例旅程、beta 回饋閉環、支援流程）。
- Guardrails: Public MVP 前，功能驗收與營運就緒需同時達標。

### D-2026-03-07-04
- Date: 2026-03-07
- Status: Accepted
- Context: 現況已有 auth/cloud save、Plan Lab、scenario seeds、quality gates 基礎；缺口在旅程整合與可行動輸出。
- Decision: 上市策略採「整合既有能力成完整旅程」，不以 engine 重做作為主軸。
- Guardrails: 維持「minimal change / no engine modifications」原則；若觸及 engine 需額外回歸證據與相容性說明。

### D-2026-03-07-05
- Date: 2026-03-07
- Status: Accepted
- Context: Phase A 需要將 Plan Lab 轉成可直接採用的家庭決策入口，同時補齊最小可行動摘要，但必須維持 engine 穩定與 scenario 隔離。
- Decision: Plan Lab 決策模板 v1 只上線 `home_purchase`、`new_baby`、`income_shock` 三類，全部走既有 patch + experiment group 管線；摘要層以 KPI delta heuristic 產生 risk trend/timing、driver 與建議，不新增 engine 計算介面。
- Guardrails: 不可寫回 baseline；模板執行需受 availability guard 保護（例如無可編輯收入事件時禁用 income shock）；所有新文案必須走 i18n key。

### D-2026-03-07-06
- Date: 2026-03-07
- Status: Accepted
- Context: Local Playwright E2E coverage needs authenticated case/scenario access, but the app currently relies on a real Supabase user for persistence and must not weaken production auth or the /member/cases entry rule.
- Decision: Add a development-only E2E auth bootstrap/reset flow that signs into a dedicated Supabase account via guarded API routes and reuses Playwright storage state; do not implement a general auth bypass or change normal middleware/layout protection.
- Guardrails: Only enable when `NODE_ENV=development` and `E2E_AUTH_BOOTSTRAP=1`; require a shared secret header; use a dedicated non-human account only; keep post-auth destination at `/{locale}/member/cases`; never expose this flow as a production or preview auth shortcut.

### D-2026-03-08-01
- Date: 2026-03-08
- Status: Accepted
- Context: The member create-case modal already had a blank/preset scaffold, and the repo also contains a direct seed-to-scenario draft path. Phase A needs a safe preset entry that lowers first-run friction without changing lifecycle, hydration, or routing assumptions.
- Decision: In member flow, `create mode preset` means onboarding-prefill only: create the case/scenario first, map the selected seed into a scenario-scoped onboarding draft, and then route into onboarding. The initial productized allowlist for this member entry is six seeds: `single-renter`, `dual-income-home`, `dual-income-rental`, `new-baby`, `new-baby-helper`, and `high-asset`.
- Guardrails: Do not mark the scenario onboarded up front, do not route directly to app/dashboard, and do not add a second server-side seed creation path for member create-case.

### D-2026-03-08-02
- Date: 2026-03-08
- Status: Accepted
- Context: Overview KPI 數量持續增加，需要讓使用者自訂重點卡片，同時必須維持 scenario 隔離、避免偏好跨 case/scenario 洩漏。
- Decision: KPI watchlist 偏好採 scenario-scoped 儲存（`scenario.meta.overviewKpiWatchlist`），Overview UI 採 library（全部可用）+ watchlist（已選）雙層；預設保留核心 KPI，編輯能力提供增刪與排序。
- Guardrails: 只允許寫入 active scenario 的 meta；不得引入全域設定寫入路徑；重載後需由既有 scenario store persistence/hydration 還原且不影響其他 scenario。

### D-2026-03-09-01
- Date: 2026-03-09
- Status: Accepted
- Context: Plan Lab v1 決策模板已有入口，但缺少本地成本估算說明與預設檔位，使用者難以理解數值來源；同時需維持 scenario 隔離。
- Decision: 在 Plan Lab 決策模板層新增本地常見成本範圍與三檔估算（保守/中位/進取），並加入「為何這樣估算」短教學提示；使用者檔位偏好存於 `scenario.meta.planLab.decisionTemplateCostProfile`（scenario-scoped）。
- Guardrails: 不修改 engine 計算介面；僅於 active scenario 寫入 meta；所有新增文案走 i18n key。

### D-2026-03-09-02
- Date: 2026-03-09
- Status: Accepted
- Context: 使用者要求 onboarding 後可依人生階段分流模板建議，且 Compare 頁預設 KPI 需與 persona 相關，同時必須保留 scenario 隔離與可隨時切換。
- Decision: 新增 scenario-scoped `scenario.meta.personaFocuses`（可多選：family/fertility/education/retirement）。Onboarding v3 負責收集與推薦模板，Plan Lab Compare 允許隨時切換並用於 KPI 卡排序。
- Guardrails: persona 偏好只允許寫入 active scenario meta；不得新增跨 scenario 共用狀態；KPI 優先序屬 UI 呈現層，不修改 engine 介面。

### D-2026-03-09-03
- Date: 2026-03-09
- Status: Accepted
- Context: 使用者回饋 Plan Lab 決策模板選擇的成本檔位（保守/中位/進取）與後續人生事件 wizard 預設值存在落差，導致心理模型斷裂（例如模板顯示婚禮中位範圍，但 wizard 未對應該預算）。
- Decision: Plan Lab decision template 在開啟 bundle wizard 前，先依模板 id + 成本檔位產生 `BundleWizardInput`（以 scenario baseMonth 作為月份 anchor）並注入 wizard 初始狀態；marriage/new_baby/home_purchase 皆走同一入口映射。
- Guardrails: 僅作 UI/draft 層預填，不直接寫 baseline；所有偏好與草稿仍維持 scenario-scoped；不修改 engine 公式或 domain event schema。


### D-2026-03-09-04
- Date: 2026-03-09
- Status: Accepted
- Context: Plan Lab 原本單一 housing 模板同時承載「置業 bundle」與「租樓事件」兩條路徑，導致模板語意與操作預期不一致。
- Decision: 將 housing 模板拆為 `home_purchase`（映射 `life_home_purchase` bundle wizard）與 `rental_plan`（直接走 rent housing event 建立/編輯流程）；兩者文案與成本區間分離。
- Guardrails: template cost profile 仍寫入 `scenario.meta.planLab.decisionTemplateCostProfile` 且僅限 active scenario；不得新增跨 scenario 共用狀態；不修改 engine 介面。

### D-2026-03-09-05
- Date: 2026-03-09
- Status: Accepted
- Context: `rental_plan` already had a decision-template entry and rent-event flow, but bundle compare and fallback re-edit were still weaker than `life_home_purchase` when older scenarios lacked a stored `wizardInput` record.
- Decision: Treat `life_rental_plan` as a first-class life bundle alongside `life_home_purchase`: the builder emits rent housing + setup one-off cashflows with shared bundle metadata, and Plan Lab / Money may rehydrate the wizard from active-scenario bundle events when no stored bundle wizard input exists.
- Guardrails: Only read bundle events from the active scenario; do not cross scenario boundaries; do not change engine interfaces, event schema, or cost-profile persistence.

### D-2026-03-09-06
- Date: 2026-03-09
- Status: Accepted
- Context: `rental_plan` has cost-profile cards, but users still reported buy-home bias in compare copy and occasional ambiguity about which launch path (rent flow vs buy-home wizard) would be used.
- Decision: Keep `decisionTemplateCostProfile` scenario-scoped and extend rental mapping defaults explicitly (rent / deposit / agent fee / start month anchor), enforce a dedicated launch-path resolver where `rental_plan` always goes to rent housing create/edit (never buy-home bundle wizard), and add a housing-readable compare hint for rent-vs-buy framing.
- Guardrails: No engine/interface changes; only active-scenario state may be read/written; compare hint is UI-only and must not alter projection calculations.


### D-2026-03-09-07
- Date: 2026-03-09
- Status: Accepted
- Context: Plan Lab 住屋決策已拆分為置業 bundle 與租樓流程，但「新增事件 > 住屋」create modal 仍可切換按揭，使用者容易與置業模板路徑混淆。
- Decision: 在 Plan Lab 的 housing event create modal 僅允許 `rent`；`mortgage` 由 `home_purchase` 決策模板 + buy-home bundle wizard 入口承接。同步調整置業模板教學文案為「先填樓價」，並強化租樓方案為預填租金/按金/代理費。
- Guardrails: 編輯既有 housing event 保留原類型；僅限制 Plan Lab create 入口，不更動 Money 頁一般模板能力；不修改 engine/domain 介面。

### D-2026-03-09-08
- Date: 2026-03-09
- Status: Accepted
- Context: 使用者回饋置業模板卡片雖有成本範圍，但未明確把「樓價估算」作為統一輸入起點；同時 `rental_plan` 在既有 rent 事件路徑僅開啟 drawer，未帶入模板估算值。
- Decision: `home_purchase` 模板補上「估算樓價」成本列與對應文案；`rental_plan` 無論 create 或 edit 路徑皆注入成本檔位估算到租屋 drawer（租金/按金/代理費）。
- Guardrails: 僅變更 Plan Lab/UI-draft 層預填，不修改 engine/domain 介面；所有預填與偏好維持 active scenario scoped。

### D-2026-03-09-09
- Date: 2026-03-09
- Status: Accepted
- Context: Overview KPI metric detail 既有 Read More 區塊暫無文章內容，且 `zh-HK` locale 仍混有英文區塊標題，影響資訊完整性與語言一致性。
- Decision: KPI metric detail modal 改為僅保留 Action Items + Rating Scale，並補齊 rating 說明；`zh-HK` 相關 i18n key 全數改為中文。
- Guardrails: 僅調整 Overview UI / i18n 呈現層；不變更 engine、scenario 資料模型或跨 scenario 狀態邏輯。

### D-2026-03-09-10
- Date: 2026-03-09
- Status: Accepted
- Context: Marketing persona 卡片需要把「樣本旅程」導流到 member 建案例流程，但必須維持登入後固定落地 `/member/cases`，並避免任意 preset query 注入。
- Decision: Persona CTA 導向 `/{locale}/member/cases?journey=...&preset=...`；member/cases 以 allowlist resolver 解析 query（只允許 6 個 member presets），在 create dialog 預選 preset 並顯示 journey 引導文案（適用族群/目標決策/預期完成時間）。
- Guardrails: Auth 成功後路徑仍維持 `/{locale}/member/cases`；query 只影響 member UI 初始化，不直接建立 scenario 或寫入跨 scenario 狀態；未知 journey/preset 一律忽略並回退 blank flow。

### D-2026-03-18-01
- Date: 2026-03-18
- Status: Accepted
- Context: Phase B 需要把 market-entry sample journey 從「已有導流能力」提升為「可持續優化的產品入口」，但目前 `journey/preset` 的 query contract、signed-in/out handoff、invalid fallback 與 funnel ownership 仍分散在實作細節中，不利於 UX/產品/工程共同維護。
- Decision: 將 market-entry handoff contract 文件化為單一路徑：所有 persona/sample journey CTA 只可導向 `/{locale}/member/cases?journey={journeyId}&preset={presetId}`；其中 `journeyId` 代表入口敘事意圖，`presetId` 代表 allowlisted onboarding-prefill seed。query 只可用於初始化 member create dialog，不可跳過 `/member/cases`、不可直接建立已完成 scenario、不可改寫 auth 成功後落地規則。
- Guardrails: `journeyId` / `presetId` 必須允許無效值安全回退 blank flow；signed-out 使用者仍需先經 auth，再回到 `/member/cases` 承接相同 entry intent；任何後續 onboarding/app route 若要承接 journey context，只能透過既有 create-flow state 或 analytics metadata，不可引入跨 scenario 持久化捷徑。

### D-2026-03-18-02
- Date: 2026-03-18
- Status: Accepted
- Context: Market-entry persona promise 若直接綁到任意 preset，容易出現敘事誤導（例如 persona 文案承諾的決策問題超出 preset 能力），也會增加未經驗證 seed 被直接曝露到公開入口的風險。
- Decision: Persona ↔ preset 採 allowlist mapping policy：公開 market-entry 只能映射到已產品化且通過 member create flow 驗證的 preset allowlist；每個 persona 至少定義一個 primary preset，必要時可加 secondary preset 或直接回退 blank flow，但不得新增 direct scenario creation 或隱藏型 seed query。
- Guardrails: mapping policy 必須與 member create flow 的 preset allowlist 同步維護；若 persona 無安全對應 preset，寧可導向 blank create + guidance，也不可暴露未驗證 seed；所有 funnel/KPI 檢視需能以 persona、journey、preset 三層拆分，避免只看總轉化而掩蓋 persona mismatch。

### D-2026-03-18-03
- Date: 2026-03-18
- Status: Accepted
- Context: 現有 marketing landing page 雖已有 hero / persona / sample journey 基礎內容，但依賴大幅裝飾圖片，且 hero → proof → journey 的訊息路徑不夠集中，難以把公開入口 promise 對齊到實際產品可交付的第一步。
- Decision: Market landing page v1.1 採文字主導 IA：hero 直接承諾 first-session outcome，proof points 聚焦 cashflow / net worth / guardrails，persona 區改為無裝飾圖片的 decision cards，sample journey 卡需明確寫出「起始條件 + 決策問題 + 3-step 操作 + 可見輸出」。
- Guardrails: 不新增 direct scenario creation 或改變 `journey + preset` handoff contract；所有新文案繼續走 i18n key；market-entry promise 只可描述目前產品已能交付的 baseline / compare / Plan Lab 能力，避免超賣未上線功能。

### D-2026-03-20-09
- Date: 2026-03-20
- Status: Accepted
- Context: Public entry → member create flow already had `journey + preset` deep links, but the policy was still partially implicit across maps, CTA code, and auth handoff behavior. This made it too easy for future changes to drift away from the documented `/member/cases` landing rule or expose non-productized presets.
- Decision: Canonicalize the member create entry contract in one source of truth: define allowlisted journey ids, each journey’s primary preset mapping, and the explicit `fallbackToBlank` rule together; derive member query resolution and marketing CTA href construction from that policy. Signed-out auth handoff may preserve entry intent only by returning to `/{locale}/member/cases` with the same sanitized `journey/preset` intent rehydrated after auth.
- Guardrails: `/member/cases` remains the only allowed landing path after auth; query parsing may read only `journey` and `preset`; unknown journeys or non-allowlisted presets must sanitize to blank flow; journey-to-preset inference may occur only through the canonical allowlist policy; no direct scenario creation, onboarding-complete shortcut, or cross-scenario persistence may be introduced.

### D-2026-03-20-10
- Date: 2026-03-20
- Status: Accepted
- Context: PM / UX could already inspect landing CTA clicks and preset-start events, but the market-entry measurement layer still missed two publishability-critical checkpoints: whether sample-journey cards were actually seen, and whether create-case truly succeeded before onboarding. The review cadence itself also remained implicit, making it hard to decide when a public sample journey was truly ready to scale traffic.
- Decision: Complete the market-entry funnel as a metadata-only, vendor-agnostic contract. The allowed payload remains strictly `locale`, `journeyId`, `presetId`, and `isSignedIn`; new events are `sample_journey_impression` (once per sample-journey card exposure path per mount) and `case_created` (only after `createCaseAction` genuinely succeeds and before the existing onboarding transition). `journey_cta_click` is shared across persona CTA and sample-journey CTA so click cohorts stay comparable. Product review ownership is formalized in `MARKET_ENTRY_REVIEW_RITUAL.md`, which defines weekly KPI formulas, cohort cuts, minimum sample-size warnings, and the “ready to scale traffic” gate.
- Guardrails: Do not add case ids, scenario ids, financial values, or other business payload to market-entry analytics; do not bypass `/{locale}/member/cases`; do not reinterpret create success as onboarding completion; do not introduce direct scenario creation or onboarding-complete shortcuts; impression dedupe must stay render-exposure-scoped so re-renders do not inflate counts.

### D-2026-03-20-11
- Date: 2026-03-20
- Status: Accepted
- Context: Phase A roadmap still had two deferred Plan Lab templates (`mortgage_rate_hike`, `move_home`) without a stable product contract. PM requested that these templates remain off until onboarding start and onboarding review → completion beta metrics are stable, while engineering only extends adapter / UI / template mapping and avoids engine or cross-scenario persistence changes.
- Decision: Define the next two Plan Lab templates as beta-gated decision-template contracts only. Both still enter from Plan Lab Add Experiment, read only the active scenario baseline plus existing editable housing/mortgage events, write through the existing Plan Lab patch / experiment-group path, and consume the existing KPI delta summary without engine-interface changes. `mortgage_rate_hike` anchors on an editable mortgage event and prefills a higher reset-rate draft; `move_home` anchors on an editable housing event and prefills a later housing-timing draft. Exposure stays behind a launch gate until onboarding start + review→completion metrics are stable.
- Guardrails: Availability must fail closed. If the launch gate is off, the templates must not appear in the user-facing picker. Once enabled, `mortgage_rate_hike` requires at least one editable mortgage event and falls back to a disabled reason instead of inventing data; `move_home` requires at least one editable housing event and otherwise falls back to a disabled reason that directs users to existing housing create templates. Do not add engine formulas, new persistence schema, cross-scenario state, or direct baseline writes.
