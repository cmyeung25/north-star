# North Star Product Roadmap
Last updated: 2026-03-21

## Product Focus
- 產品定位: 香港/亞洲家庭人生現金流決策平台。
- 核心策略: 不重做 engine，優先整合既有能力為可上市的完整使用者旅程。
- 架構邊界: 維持 engine-domain 分離、scenario/case 隔離、登入後先進 member/cases 流程。

## Phase Overview
| Phase | 目標 | 退出條件 | 狀態 |
|---|---|---|---|
| Phase A: Closed Beta Foundation | 讓真實家庭可完成首次建模、可回來更新、可完成一次重大決策比較 | 完成 onboarding/property、Plan Lab 決策模板化、guardrails、preset 主流程整合、beta 回饋閉環 | In Progress |
| Phase B: Public MVP Readiness | 對外提供「可理解結論 + 可執行下一步」的體驗，並具備基本上市支援能力 | 完成可行動輸出、market entry、營運支援流程 | Not Started |
| Phase C: Post-MVP Deferred | 擴展進階分析與專業使用場景 | 明確列入延後清單，不阻擋 MVP 上市 | Planned |

## Phase A: Closed Beta Foundation
### 主要交付
1. Onboarding + Property Bundle 完整化
- 家庭成員/收入/支出/物業/按揭/租務輸入流程整合為單一路徑。
- 物業資料明確區分現價、按揭基準、剩餘期數、每月供款、持續成本、出租狀態與租金。
- [x] Onboarding housing/property IA 已收斂：在資產步驟先提示「現時租屋 vs 已持有物業」分流，並把自住物業／出租物業／有按揭／無按揭欄位分段呈現與補齊 helper 文案、百分比方向說明、review 摘要鋪位。
- [x] Housing data semantics 已對齊 onboarding draft / adapter / compiler：down payment 百分比固定以物業價值為基準、`usage` 缺漏時以正數租金保守推斷出租物業、`mortgagePrincipalOutstanding <= 0` 一律視為無按揭，不再衍生 0 金額 mortgage artifacts。
- [x] Onboarding v3 收入/支出手動項目新增分類 dropdown（沿用既有 taxonomy），並在卡片顯示分類摘要以降低誤分類。
- [x] Onboarding v3 收入/支出步驟分類摘要改用與 Money 頁一致的 `MoneyMetaTags` 樣式，並修正家庭成員自動薪資事件預設分類為 salary（避免落入「其他」）。
- [x] Onboarding v3 新增「人生階段重點（可多選：成家/生育/教育/退休）」；依所選重點即時顯示推薦模板清單，並於提交後寫入 scenario-scoped `scenario.meta.personaFocuses`。
2. Plan Lab 決策模板化
- 將常見決策（生育、收入衝擊、利率上升、置業/換樓）變成可直接套用的實驗模板。
- 支援 baseline vs experiment 比較與保存。
- [x] v1 已交付：`home_purchase`、`new_baby`、`income_shock` 三類模板已接入「新增實驗」入口，並沿用既有 patch/group 流程（不污染 baseline）。
- [x] v1 已交付：新增最小可用決策摘要層（risk timing/trend、top drivers、recommended actions），以 KPI 差值 heuristic 產生（不改 engine）。
- [ ] 下一批模板：利率上升與換樓模板，只在 onboarding start 與 onboarding review → completion 的 beta 指標穩定後啟動；本輪先收斂最小產品契約、availability guard 與 fallback policy。
  - [ ] `mortgage_rate_hike` 使用者決策問題：如果未來按揭重訂 / 加息，現金流安全邊際會否明顯惡化？完成定義：由 Plan Lab Add Experiment 進入；只讀 active scenario baseline / existing editable mortgage event；以既有 patch / experiment-group 管線預填較高按揭利率草稿；沿用既有 KPI delta summary，不改 engine interface。
  - [ ] `move_home` 使用者決策問題：如果把搬屋 / 換樓時點延後或重排，短中期現金流壓力會否改善？完成定義：由 Plan Lab Add Experiment 進入；只讀 active scenario baseline / existing editable housing event；以既有 patch / experiment-group 管線預填較後住屋時點草稿；沿用既有 KPI delta summary，不改 engine interface。
- [x] Plan Lab 決策模板加入本地常見成本範圍（結婚、生育、育兒、買屋/租樓、退休）與三檔預設（保守/中位/進取），並提供「為何這樣估算」教學提示。
- [x] Plan Lab 決策模板與人生事件 wizard 預設值已打通：按所選成本檔位（保守/中位/進取）帶入對應 bundle 初始輸入，避免模板卡片估算與 wizard 建立值脫節。
- [x] Plan Lab housing 模板已拆分為 `home_purchase`（bundle wizard）與 `rental_plan`（rent housing event），避免單一模板同時代表兩條操作路徑。
- [x] `life_rental_plan` now uses the same life-bundle compare/edit model as home purchase, including rent housing + setup one-off outputs and wizard re-edit hydration.
- [x] `rental_plan` 成本檔位映射已補齊（租金/按金/代理費/起租月份），且 Compare 摘要新增租 vs 買可讀提示（cashflow pressure + upfront cash hit），避免偏向置業語境。
- [x] Plan Lab「新增事件 > 住屋」create modal 已限制為租屋事件，置業按揭入口統一走 `home_purchase` bundle wizard。
- [x] Housing decision templates now keep estimate-to-drawer alignment: `home_purchase` includes estimated purchase price guidance, and `rental_plan` pre-fills rent/deposit/agent fee in both rent create and rent edit drawer paths.

3. Guardrails / Completeness 層
- 建立 completeness score 與關鍵警示（缺漏、重複計算、物業自住/出租衝突、按揭欄位不一致）。
- [x] v1 已交付：onboarding completeness score 規則層已拆出，使用 5 個輸入群組（家庭結構、收入、固定支出、住屋資訊、資產 / 負債基本值）輸出 `ready / needs_attention / incomplete` summary model，且只讀 active onboarding draft + active scenario context、不依賴 engine。
- [x] v1 已交付：onboarding guardrails 規則層已建立，覆蓋 `key_missing / obvious_conflict / basic_inconsistency / potential_double_counting` 四類；目前先聚焦 housing/property 常見錯誤（物業用途缺漏、按揭核心欄位缺漏、自住/出租衝突、housing state 與 cost mismatch、可能重複輸入住屋支出），並輸出 UI 可直接消費的 summary model（含 severity / message key / action hint / target step）。
- [x] onboarding review / submit summary 已接入 completeness + guardrail summary，並提供逐項返回修正入口、submit/save feedback、以及 `onboarding_review_viewed` / `guardrail_shown` / `guardrail_fixed` / `onboarding_completed` funnel analytics（只含 funnel metadata）。
- [x] v1.1 severity calibration 已完成：只有真正會扭曲 baseline 核心語意的規則保留 `critical`，疑似重複輸入與資料不一致降為 `warning` / `info`，避免 onboarding review 過度示警。
- [x] review step hierarchy 已按 severity 分層：guardrails 改為 `critical / must fix`、`warning / review recommended`、`info / heads-up` 三段顯示，並在無 guardrail 時提供 clear state，避免 info / warning 被誤解為阻止提交。
- [x] fix-loop CTA clarity 已補強：每條 guardrail 現在會先顯示將返回的 step + section，CTA 文案亦明確標示會回到哪一步，保留既有 `onFixGuardrail -> stepIndexById` 導航契約不變。
- [x] guardrail copy rewrite & locale parity pass 已完成：housing/property guardrails 改寫為「人話 + 原因 + 下一步」語氣，並補上 onboarding guardrail placeholder parity / mojibake lint，降低警示疲勞與語系 drift。
- [x] highest-friction housing/property guardrails 已完成 focused calibration：保留既有 baseline-distortion severity 邏輯，只微調 rule target section（例如 property vs housing）與 review 層視覺層級，讓 critical / warning / info 更易分辨且減少回修猶豫。
- [x] analytics review pack v1 已補齊：onboarding funnel payload 現在加入安全的 `reviewSessionId` / `reviewSourceContext`、guardrail metadata allowlist 與 `guardrail_fixed` 消失判準，並補上每週 calibration review 方法文件，讓 PM/UX 可穩定檢視 top blockers、低 fix 成功率規則與 review → completed conversion。
- [x] analytics review pack v1 現已 operator-ready：新增 weekly builder / export helper，可直接把 metadata-only funnel event arrays 匯總成 review→completed conversion、top shown guardrails、lowest fix-success guardrails、review-without-completion candidates 四個週報 section，無需新增 persistence。
- [x] weekly calibration v1.2 已收斂高摩擦 guardrails 優先名單：`property_usage_missing` / `duplicate_current_home_housing_costs` / `duplicate_rent_expense_inputs` 視為 top-shown 候選；其中 duplicate current-home path 降為 `info`，並連同 `mortgage_property_basics_missing`、duplicate rent copy 一併改寫成「原因 + 影響 + 下一步」與更明確 fix path。
- [x] weekly review workflow 已固定：新增 `onboardingReviewPack` workflow helper 與產品文件，將上一個完整週窗匯出、priority guardrail 檢視、sample-size / locale-bias 檢查，以及 persona/preset/journey distortion 需回看 market-entry weekly board 的規則正式化。
- [x] 兩週 evidence-driven focused UX calibration 已完成首輪：針對 `property_usage_missing`、`duplicate_current_home_housing_costs`、`duplicate_rent_expense_inputs`、`mortgage_property_basics_missing` 再微調文案與 fix path，把現居路徑／物業定位講得更白，避免高 show rate 被誤讀成 blocking 錯誤。
- [ ] 下一步：依 beta feedback 與固定 weekly review workflow 結果，繼續調整 guardrail 文案、誤報率與 severity/copy 策略，並累積至少兩個完整週窗的實際 cohort 證據，避免警示疲勞或誤判高 show rate。
4. Presets 接入主流程
- [x] v1 已交付：member/cases「建立案例」支援 blank / preset create mode；preset 以 onboarding-prefill 方式接入，不直接建立已完成 scenario。
- [x] v1 已交付：member 入口 preset allowlist 擴至 6 個產品化 seeds（single-renter、dual-income-home、dual-income-rental、new-baby、new-baby-helper、high-asset）。
- [x] marketing persona CTA 現在可攜帶 `journey + preset` query 導流到 member/cases，並在 create dialog 預選 allowlist preset 與顯示 journey 引導文案（不改登入後先到 member/cases 規則）。
- [x] marketing landing page 已新增 sample journey cards（起始條件 + 3-step 操作 + 可見輸出），每張卡 CTA 均沿用 `journey + preset` deep-link 到 member/cases。
- [x] market-entry handoff contract 現已產品化：`journey/preset` policy 收斂為單一 canonical source（allowlisted journey ids、primary preset mapping、blank fallback），signed-in / signed-out 都只可回到 `/{locale}/member/cases` 承接同一 create intent。
- [x] UX / IA contract 已補完：app 內承接同一 onboarding-prefill 心智模型的候選入口，只限 scenario-scoped setup / recovery surfaces，不可落入 Plan Lab template 或 Money event create 流程。
- [x] Beta 實作入口 1：scenario onboarding start / resume shell 現已顯示最小版 preset suggestions，且只在未完成 onboarding 的 active scenario 顯示；CTA 只會建立 / 取代 scenario-scoped onboarding draft 起點，然後留在同一 onboarding wizard 繼續補完。
- [x] Beta 實作入口 2：Overview / Dashboard 的 onboarding-incomplete recovery banner 現已顯示 preset suggestions；CTA 只會替 active scenario 建立 / 取代 onboarding draft 起點，然後返回 onboarding 繼續補完，不會直接完成 scenario 或改 baseline。
- [x] Beta 實作入口 3：Scenario Settings → Data Management 現已提供 guarded 的 preset recovery 入口，只在使用者明確進入資料管理 / reset surface 時顯示，並以較克制的 restart / replace draft copy、覆蓋警告與返回 onboarding 的後續動作承接 active scenario。
- [x] Beta 文案與 IA：onboarding start / resume 入口已補齊與 member create dialog 對齊的 journey guidance + ETA + outcome copy 與 replace warning；共享 summary presenter 現已明確採用 `audience → starting context → ETA → outcome` 結構，且文案再次鎖定為「重新選擇 onboarding draft 起點」，不是快速完成 scenario 或直接新增 baseline。下一步仍需把同一套 setup/recovery copy rule 延伸到 dashboard recovery，並讓 settings recovery 維持較簡潔的 reset/restart copy，避免與一般資料維護操作混淆。
- [x] 三個 preset recovery surfaces 已補上更明確的 copy rule：onboarding / dashboard / settings 現都會直接聲明自己不是 Plan Lab experiment 或 Money event create/edit flow，dashboard 另有專屬 recovery heading / CTA，settings 則維持更克制的 reset 語氣。
- [x] Guardrail：source-guard 測試現已同時鎖定 onboarding、dashboard recovery、與 settings data-management recovery 三個 preset helper；它們不得出現在 Plan Lab Add Experiment、Money add-event / template picker、或任何 baseline 事件 create/edit drawer，避免把「建立 baseline 起點」誤解成「新增事件」或「新增實驗」。
5. Beta 回饋閉環
- 以封閉測試流程建立「收集問題 -> 分類 -> 迭代 -> 驗收」節奏。
- [x] Local dev now has a dev-only E2E auth bootstrap (dedicated Supabase test account + reset) so Playwright can validate member/app flows without weakening normal auth boundaries.

### 完成定義
- 一個雙職家庭可於 20 分鐘內建立基線，並完成至少一個重大決策比較。
- 使用者可在不同時段重返同一 scenario 持續更新，資料不外洩到其他 case/scenario。
- Guardrails 可攔截高風險輸入問題並提供可理解提示。

### 不做項
- 不改 projection engine 演算法與對外介面。
- 不做 Monte Carlo、銀行自動同步、advisor 專業管理功能。

### 驗收條件
- 封閉 beta 受試者可完成「建模 -> 比較 -> 儲存 -> 回看」完整流程。
- 主要路徑無白屏，member -> app 過場維持 overlay/skeleton 體驗。
- Quality Gates 維持全綠（允許非阻斷警告）。

## Phase B: Public MVP Readiness
### 主要交付
1. Actionable Output
- 提供風險年份、方案差異摘要、關鍵驅動因子與下一步建議。
- [x] Overview 已新增 KPI health scorecard（excellent/progressing/vulnerable/informational/no-data）與分佈視覺條，並與 KPI 卡共用同一組 i18n status key。
- [x] Overview 已新增 scenario-scoped KPI watchlist（library + watchlist）：使用者可在總覽編輯 KPI 增刪與排序，且偏好只儲存在 active scenario，重載後保留。
- [x] Overview KPI watchlist drawer 的 KPI library 卡片已新增「現時狀態」badge，與 health scorecard 分級一致（excellent/progressing/vulnerable/informational/no-data）。
- [x] Overview `cashRunway` / `riskLevel` KPI 卡加入詳情 CTA，並可於 mobile carousel 觸發對應詳情互動（runway/risk）。
- [x] Overview `cashRunway` / `riskLevel` KPI 卡與 detail modal 已統一計算來源（runway simulation + risk assessment），避免主卡與 modal 等級不一致。
- [x] Overview KPI watchlist 每張卡都可開啟統一指標說明 modal（Action Items / Rating Scale），內容補齊評級說明並暫時移除 Read More 區塊，避免空內容入口。
- [x] Overview KPI `avgNetCashflow` / `avgNonSalaryIncome` / `avgFunBudget` 已改為 null-safe 顯示：`null` 顯示 emptyValue，並與 scorecard 的 `no-data` 對齊。
- [x] Overview DashboardMetrics 新增靜態推導 KPI（`savingsRate12m`、`expenseToIncomeRatio12m`、`debtToAssetRatio`、`netWorthGrowth12m`），並補齊 KPI 卡 tooltip 公式與 i18n（en/zh-HK）。
- [x] Overview KPI formatter 已統一處理 no-data：數值為 `null/NaN` 顯示 `dashboard.common.emptyValue`；比率型 KPI 在分母為 `0` 時回傳 `null`，避免顯示誤導性的 `0.0%`。
- [x] `zh-HK` locale 已清理 overview 與 Plan Lab/health summary 常見殘留英文術語（如 Baseline/Scorecard/proxy），並新增 locale lint 測試確保 placeholder token（如 `{months}`、`{endMonth}`、`{years}`）與 `en` 對齊。
2. Market Entry + Sample Journey
- 上線市場入口頁（價值主張、適用族群、示例旅程）。
- 提供可直接體驗的家庭場景範本與引導。
- [x] v1 已交付：建立 market-entry tracking abstraction（vendor-agnostic），並接入 landing/persona/member preset 關鍵漏斗事件（landing view、journey CTA、auth modal、preset create、onboarding start）。
- [x] v1.1 訊息架構收斂：定義入口頁 hero / problem framing / sample journey / CTA proof points 的區塊順序與必備訊息。
- [x] v1.1 persona ↔ preset mapping policy：每個 market-entry persona 只可映射至 allowlisted member preset；若無安全對應則回退 blank flow，不新增 direct scenario creation。
- [x] v1.1 journey deep-link contract：統一使用 `/{locale}/member/cases?journey={journeyId}&preset={presetId}` 作為入口意圖傳遞；query 只允許初始化 member create dialog，不可繞過 `/member/cases` 或直接標記 scenario 已完成 onboarding。
- [x] v1.1 funnel tracking completion：market-entry event dictionary 已補齊 `sample_journey_impression`、`case_created`，sample journey CTA 現與 persona CTA 共用 vendor-agnostic `journey_cta_click`，member create 成功會在真正成功後發送 `case_created`；payload 維持 metadata-only（`locale` / `journeyId` / `presetId` / `isSignedIn`），不含任何 case/scenario/financial business payload。
- [x] v1.1 A/B 文案實驗位：hero value prop、persona CTA/summary、sample journey summary 已補齊 vendor-agnostic experiment slot contract；slot key 固定為 `landing.hero.value_prop`、`landing.persona.cta_summary`、`landing.sample_journey.summary`，variant naming 規則統一為 lowercase snake_case + `_v{n}`（例如 `control_v1`、`decision_first_v1`）。實驗只可改文案與排序，不可改 `/{locale}/member/cases?journey={journeyId}&preset={presetId}` handoff contract，也不可直接暴露 hidden preset。
- [x] v1.1 sample journey content kit：為至少 3 個 target personas（單身租屋、雙職家庭置業、新手爸媽）定義起始條件、3-step 操作、可見輸出與預期決策問題。
- [x] v1.1 member handoff guidance：create dialog / onboarding entry 明確承接 journey promise（適用族群、預計完成時間、會得到什麼結論），降低落差。
- [x] v1.1 KPI baseline & review cadence：已新增 `docs/product/MARKET_ENTRY_REVIEW_RITUAL.md`，定義 weekly review cadence、KPI formulas、persona/journey/preset cohort breakdown、minimum sample-size warnings，以及「ready to scale traffic」判準；未達門檻前仍不得宣稱 sample journey 已可上市。
- [x] v1.1 experiment governance：market-entry analytics allowlist 現可選擇帶 `experimentSlotKey` / `experimentVariant` 兩個 metadata-only 欄位，以對齊 slot cohort review；嚴禁加入 case/scenario id、財務金額或其他 business payload，member resolver 亦必須忽略 experiment query/metadata 並維持 invalid mapping → blank flow。

### Persona coverage matrix（public entry → member preset）
| Journey / Persona | Primary preset | Fallback | Notes |
|---|---|---|---|
| `officeSaver` / 單身租屋儲蓄族 | `single-renter` | blank create | 適合先做租屋現金流 baseline，再比較首置時機 |
| `coupleHome` / 雙職家庭置業 | `dual-income-home` | blank create | 適合已有置業意圖的雙收入家庭 |
| `newParents` / 新手爸媽 | `new-baby` | blank create | 以育兒前後現金流壓力作為首個 compare 問題 |
| `mortgageOwner` / 已有按揭家庭 | `high-asset` | blank create | 先以較高資產/按揭家庭 baseline 承接，再進一步調整 |

Blank fallback rule：任何未知 `journey`、非 allowlisted `preset`、或未來沒有安全 primary preset 的 persona，都必須回到 `/member/cases` 的 blank create flow；不可曝露隱藏 seed、不可直接建立 scenario、不可跳過 auth/member landing。
3. 穩定性與支援流程
- 建立錯誤分級、支援回報、發布檢核與回滾指引。

### 完成定義
- 新用戶不需專業背景也能理解輸出結論並採取下一步。
- 產品入口、引導、核心功能一致且可追蹤轉化。

### 不做項
- 不做跨市場稅務深度優化。
- 不做複雜 advisor 協作工作台。

### 驗收條件
- 公測用戶能完成首次體驗且能說明「哪一個方案較穩陣、原因是什麼」。
- 支援流程可處理常見資料與模型疑問。
- Market Entry 最低 KPI（first-run baseline）：
  - 首次體驗完成率（landing 進站 → 完成 onboarding）≥ 20%。
  - Journey 點擊 → 建立案例轉化率（`journey_cta_click` → `preset_create_submitted`）≥ 35%。
  - Onboarding 啟動率（`preset_create_submitted` → `onboarding_started`）≥ 85%。
  - Landing → Journey CTA CTR ≥ 12%。
  - Sample journey 導流之 case created → onboarding completed completion gap < 25 個百分點（避免 create 後大量流失）。

## Phase C: Post-MVP Deferred
### 延後項目
- Full Monte Carlo 模擬。
- 自動銀行/投資帳戶同步。
- 深度 advisor / firm-level 管理能力。

### 延後原則
- 以上項目僅在 MVP 留存與決策完成率達標後才排入實作。
- 不得以延後項目作為阻擋 Closed Beta 或 Public MVP 的前置條件。

- [x] weekly dashboard / export productization：新增 `marketEntryReviewBoard` + `weeklyProductAnalyticsDashboard`，把 onboarding weekly review workflow 與 market-entry review ritual 接成固定 internal dashboard / JSON / CSV export；market-entry contract 同步補上 metadata-only `onboarding_completed` 與 experiment-slot attribution carry-over，讓 signed-in/out handoff 與 experiment cohort 可直接看板化。
