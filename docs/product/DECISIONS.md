# North Star Product Decisions

Last updated: 2026-03-20

## Decision Log

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
