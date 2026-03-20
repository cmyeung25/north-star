# North Star Implementation Status
Last updated: 2026-03-20 (guardrail copy rewrite & locale parity pass)

## Readiness Baseline
| 指標 | 分數 | 說明 |
|---|---:|---|
| Core infra readiness | 70% | auth/cloud save、scenario persistence、核心路由與 quality gates 已可運行 |
| Closed Beta readiness | 71% | 核心能力存在，Plan Lab 模板入口與摘要層已前進主流程，onboarding housing/property IA 已更清晰，且 review / submit 前已可看到 completeness + housing/property guardrails summary、severity 分組、返回修正入口、較低壓力的 guardrail 文案與提交回饋 |
| Public MVP readiness | 44% | 可行動摘要層已有最小可用品質；market entry 訊息架構已較一致，且 onboarding funnel 已補上 review / guardrail / completion 事件與 guardrail locale parity lint，但營運支援與漏斗補齊仍有缺口 |

## Capability Matrix
| 能力模組 | 進度 | 現況 | 上市缺口 |
|---|---:|---|---|
| Onboarding + Property Bundle | 78% | 已有家庭/收入/支出/物業/按揭欄位與流程骨架；housing/property IA 先區分「現時租屋 vs 已持有物業」，再分流自住／出租／按揭欄位與 review 摘要。onboarding draft → v3 asset/compiler 映射現已對齊：down payment 百分比不再因 custom mortgage base 翻轉語意、`usage` / 租金 fallback 更一致、0 principal 不再生成假按揭資料；guardrails v1 亦已覆蓋 housing/property 最常見錯誤。 | 需補齊既有物業 household 的一致輸入與更完整的 review 修正入口 |
| Plan Lab 決策化 | 78% | 已接入 3 類決策模板（置業/生育/收入衝擊）與模板可用性 guard；並已把模板成本檔位（保守/中位/進取）對應到人生事件 wizard 初始值，實驗群組與保存流程維持一致 | 尚缺利率上升/換樓等後續模板與模板成效校準 |
| Persistence / Auth | 81% | case/scenario, cloud save, revision conflict, and dev-only E2E auth bootstrap/reset are in place | Still needs tighter onboarding/preset/compare integration and CI coverage |
| Guardrails / Completeness | 86% | 已有 assumptions / Plan Lab 局部 warning；onboarding completeness score + guardrails v1 現已接入 review / submit UX，使用者可在提交前看到總體完整度、overall guardrail summary、依 severity 分組的 `critical / warning / info` 區塊、逐項返回修正入口與清晰 submit/save feedback；housing/property guardrails severity 已完成首輪 calibration，只有會扭曲 baseline 核心語意的規則維持 `critical`，重複輸入類則降為 `warning` / `info`。本輪亦已把重複輸入／自住出租衝突／按揭缺漏等 guardrail copy 重寫成「人話 + 原因 + 下一步」，並補上 onboarding guardrail locale parity / mojibake lint，降低誤報疲勞與語系 drift 風險。analytics 亦已量測 review / guardrail / completion 漏斗 metadata | 仍需依 beta feedback 校準 guardrail 誤報率與 review/dashboard 解讀方式 |
| Actionable Output | 61% | 已加入 Plan Lab 決策摘要（風險節奏/方向、正負 driver、下一步建議）；Overview 新增 KPI health scorecard 與 scenario-scoped KPI watchlist（可增刪/排序並持久化） | 仍需擴展到跨頁輸出與可下載/可分享格式 |
| Preset 主流程整合 | 68% | member create modal 已支援 blank/preset；marketing persona CTA 可攜帶 allowlisted `journey/preset` 導流並在 member 預選 preset，create dialog 亦會顯示 journey 承諾（適用族群 / 目標決策 / 預計完成時間 / 首次可見輸出）；preset 仍走 onboarding-prefill 且限 6 個 allowlist seeds | app 內延伸入口與分組資訊架構仍待 beta 回饋收斂 |
| GTM / 營運就緒 | 31% | 已有 marketing pages、sample journey -> member/cases 導流入口，且 landing IA 已重整為 hero → proof → persona → journey → CTA | 仍缺 beta feedback loop、支援流程 |

## Market Entry + Sample Journey Progress
| 子項 | 進度 | 現況 | 阻塞項 | 下一里程碑 |
|---|---:|---|---|---|
| 入口頁訊息架構 | 78% | landing 已重整為 hero proof、文字主導 persona cards、sample journey 決策問題與明確 final CTA handoff | 仍未建立 A/B slot metadata 與 sample journey impression tracking，無法持續優化訊息效果 | 補 experiment slots 與 sample journey impression event，讓訊息迭代可量測 |
| Persona ↔ Preset Mapping | 60% | 已有 6 個 allowlisted presets，且 marketing CTA 可帶 `journey/preset` 到 member create flow | 仍缺 persona coverage matrix 與 fallback policy 文件化，容易出現「persona promise > preset 能力」落差 | 固化 persona-to-preset allowlist mapping 與 blank fallback 條件 |
| Journey Deep-link / Handoff | 70% | 已建立 `journey + preset` query handoff 到 `/member/cases`，member 端會預選 preset，並用 guidance copy 承接適用族群 / 目標決策 / 預計完成時間 / 首次可見輸出 | contract 已在產品文件中收斂，但仍缺 signed-in/out 漏斗驗證與 onboarding entry 後續承接細節 | 補 signed-in / signed-out handoff 驗證與 onboarding entry guidance 對齊 |
| Funnel Tracking | 61% | 已量測 landing / CTA / auth / preset create / onboarding start，且 onboarding review / guardrail / completed 已補上 vendor-agnostic funnel events | 仍缺 `sample journey impression`、`case created` 與 dashboard/review cadence 定義 | 補齊剩餘漏斗事件字典與每週轉化檢視板 |
| A/B 文案實驗位 | 15% | 目前僅有 vendor-agnostic tracking 抽象，可承接未來實驗 metadata | 尚未定義可實驗欄位、命名規則、最小 sample size 與停止條件 | 建立 experiment slot 命名與文案版本標記策略 |
| KPI 基線 / 驗收門檻 | 30% | 已有 v1 funnel event 與基礎轉化公式 | 尚未把 MVP 最低 KPI 與 weekly review threshold 寫入產品規格 | 將最低 KPI 納入 roadmap 驗收條件與 market-entry review ritual |

## Market Entry KPI Minimum Baseline (MVP gate)
| KPI | 最低門檻 | 現況 | 阻塞項 | 下一里程碑 |
|---|---:|---|---|---|
| 首次體驗完成率（landing → onboarding completed） | ≥ 20% | onboarding completed event 已可發送，但尚未形成 cohort dashboard 與 signed-in/out attribution 對照 | 缺跨 auth/session attribution 與週期檢視板 | 補上 completion cohort dashboard 與 attribution 規格 |
| Journey 點擊 → 建立案例轉化率 | ≥ 35% | 已可量測 `journey_cta_click` → `preset_create_submitted` | 缺 persona 分群 benchmark，未知哪些 journey 文案最弱 | 建立 persona/journey cohort breakdown |
| Onboarding 啟動率 | ≥ 85% | 已可量測 `preset_create_submitted` → `onboarding_started` | 尚未確認 signed-out auth return path 對啟動率的影響 | 比較 signed-in / signed-out 兩條 handoff 漏斗 |
| Landing → Journey CTA CTR | ≥ 12% | 已有基礎 CTR 公式，但尚未建立儀表板與 sample size 準則 | 缺 CTA placement / copy 實驗位與 review cadence | 建立週報與 CTA copy experiment plan |
| Case created → Onboarding completed 流失差 | < 25 個百分點 | 目前只能量測到 create submit / onboarding start | 缺 onboarding completed 與 create success 後續品質標記 | 補齊 case created success / onboarding completed 事件並建立 drop-off report |


## Latest Update (2026-03-18)
- Member create-case dialog journey summary now renders a fourth `outcome` line, so the handoff promise explicitly matches landing-page framing: first-session outcome + visible outputs rather than only audience / goal / ETA.
- Added locale coverage + render assertions for all allowlisted member journeys, ensuring every `journey.*.outcome` key exists in `en` / `zh-HK` and the dialog actually renders the promised conclusion line.
- Documented Phase B `Market Entry + Sample Journey` v1.1 planning scope, including message architecture, persona↔preset mapping, journey query contract, funnel tracking completion, and A/B copy experiment slots.
- Added an explicit progress table for market-entry work so product/UX can review `% / blockers / next milestone` without reading code-level notes.
- Promoted minimum KPI gates for first-run completion, journey-to-case conversion, onboarding start rate, and CTA CTR into the product status baseline, so market-entry readiness is measured against publishable thresholds rather than qualitative intent only.
- Marketing landing page IA refreshed to a text-led structure: hero proof cards, persona decision cards without decorative photos, sample journeys with explicit decision questions, and a clearer first-session CTA promise.
- Sample journey content kit now makes the decision question explicit for the three target personas (steady saver, dual-income home buyer, new parents), so marketing promise and in-product action path are easier to align.

## Latest Update (2026-03-20)
- Onboarding housing/property guardrail copy（en / zh-HK）已逐條重寫為較低壓力的產品文案：先指出系統點解提醒、再解釋可能點樣影響 baseline，最後清楚講返去邊個 step / section 修改。
- duplicate 類、property vs rent semantic conflict 類、mortgage missing 類文案已優先改寫，避免使用責備式語氣或內部術語，並令 `warning` / `info` 提示更容易被理解為「值得檢查」而非「你做錯咗」。
- locale lint 已新增 onboarding guardrail subtree 的 placeholder parity 與 mojibake 掃描，降低 `en` / `zh-HK` 語意漂移與編碼風險。

## Latest Update (2026-03-20)
- Onboarding v3 review step 現在會在每條 guardrail 卡上先顯示「按下後會返回哪個 step / section」，並把 CTA 文案改成 step-aware label，令使用者按之前已知會回到哪裡修正。
- guardrail action hint copy（en / zh-HK）已改為更具體的回修預期，例如補齊按揭利率／剩餘年期、檢查住屋支出是否重複輸入等；仍只使用既有 rule metadata，不新增 deep-link state 或 persistent fix-state。
- `onFixGuardrail` 導航行為維持不變：仍由 review step 呼叫 wizard callback，再透過 `stepIndexById` 返回既有 step，避免影響 analytics、routing contract 或 scenario isolation。

## Latest Update (2026-03-20)
- Onboarding v3 review step IA 現已把 guardrails 拆為 `critical / must fix`、`warning / review recommended`、`info / heads-up` 三個視覺區塊，並保留獨立 overall guardrail summary，讓使用者可一眼分辨真正阻止提交的問題與純提醒資訊。
- Review step 在沒有任何 guardrail 時會明確顯示 clear state，而非留下空白區塊；同時仍只消費 guardrail summary 既有 `severity`，不在 component 內重做規則判斷。
- i18n 已補齊新的 review hierarchy 文案（en / zh-HK），讓 grouped severity 標題、描述與空狀態可維持一致翻譯與測試覆蓋。

## Latest Update (2026-03-20)
- Housing semantics alignment now keeps onboarding draft → v3 asset migration consistent with compiler expectations: `downPaymentPercent` is always anchored to `propertyMarketValue`, so custom `mortgageBaseValue` no longer shrinks/expands the implied outstanding principal during migration.
- Seed/onboarding draft fallback for mortgage presence is now conservative: only positive outstanding principal is treated as `mortgageEnabled`, preventing fully paid homes from reappearing as fake mortgage cases in onboarding.
- Scenario-draft property derivation now uses explicit fallbacks: positive `rentMonthly` without `usage` infers rental property for backward compatibility, while `mortgagePrincipalOutstanding <= 0` and `holdingCostMonthly <= 0` no longer generate derived mortgage/holding-cost artifacts.
- Added focused unit coverage for renter, owner-occupied, rental-property, and mortgage/no-mortgage paths so mapper/compiler changes remain scenario-scoped and regression-resistant.


## Latest Update (2026-03-09)
- Added a lightweight vendor-agnostic market-entry analytics abstraction at `apps/web/src/lib/analytics/marketEntry.ts` with a console fallback adapter and optional runtime tracker injection.
- Instrumented marketing flow events: `market_landing_view` (landing render), `journey_cta_click` (persona CTA), and `auth_modal_open` (marketing CTA/auth entry points).
- Instrumented member preset funnel events in create-case flow: `preset_create_started` (entry intent/preset selection), `preset_create_submitted` (preset create submit), and `onboarding_started` (routing into onboarding after preset draft write).
- Event payload baseline now standardizes `locale`, `journeyId`, `presetId`, `isSignedIn` across market-entry funnel points without writing any cross-scenario business state.
- Marketing landing page now includes `SampleJourneySection` cards (start condition + 3-step actions + visible outputs), and every card CTA uses the same `journey + preset` deep-link scheme to `/[locale]/member/cases`.
- Added a focused UI test for `SampleJourneySection` rendering and CTA href query assertions (`journey` + allowlisted `preset`) to prevent regression in marketing-to-member handoff.
- Persona banner CTA now appends `journey` and allowlisted `preset` query when routing to `/[locale]/member/cases`; signed-in users keep the same destination and signed-out users still go through auth before landing member/cases.
- Member cases page now parses journey/preset entry intent with allowlist guard, auto-opens create dialog in preset mode, and keeps blank flow unchanged when query is absent/invalid.
- Create-case dialog adds journey guidance copy (audience / decision goal / expected completion time) via i18n keys in both `en` and `zh-HK`.
- Added unit tests for entry intent parsing (allowlist, fallback, invalid input, blank flow) and extended member preset i18n coverage checks for all journey keys.
- Plan Lab `home_purchase` 模板卡新增「估算樓價」成本列，並在描述中明確要求先估算樓價，減少卡片資訊與後續輸入斷層。
- Plan Lab `rental_plan` 套用在 rent_edit 路徑時也會注入成本檔位估算（租金/按金/代理費），不再只打開 drawer。
- HousingEventDrawer 在 edit 模式可接受 `initialDraft` 覆蓋，確保決策模板估算值能一致帶入租屋 drawer 欄位。
- 修正 Plan Lab 開啟 housing drawer 的狀態順序：先開 drawer 再寫入 `templateHousingDraft`，避免 `closeAllPlanLabDrawers()` 清空草稿導致套用後欄位仍為空白。
- `buildBundleWizardInputForDecisionTemplate` now keeps `rental_plan` conservative / median / aggressive mapping explicit for rent monthly, deposit, agent fee, and anchored start month.
- Plan Lab decision-template selection now resolves a dedicated launch path: `rental_plan` always goes through rent housing create/edit flow (never buy-home wizard), while `home_purchase` remains on bundle wizard.
- Compare decision summary adds a housing-readable hint for rent-vs-buy framing (monthly housing cashflow pressure and upfront cash hit), reducing buy-home-only bias.
- `life_rental_plan` now emits a rent housing event plus setup one-off cashflows (deposit / agent fee) with consistent bundle source metadata, so Plan Lab and Money can group it as one bundle.
- Bundle wizard now supports rental fallback re-edit hydration from active-scenario bundle events when older data is missing `bundleInstances[].wizardInput`.
- Plan Lab compare/title fallback now treats rental bundles the same way as home-purchase bundles, so both show up as life bundles instead of generic events.
- Plan Lab 決策模板（結婚/生育/育兒/置業）已把所選成本檔位映射為 bundle wizard 初始輸入，使用者從模板套用進入 wizard 時，預設數值會與模板卡片一致（例如結婚中位檔對應 wedding budget 300k）。
- Bundle wizard 新增 marriage input hydration：若由模板傳入 `life_marriage_plan` 的 wizardInput，會正確帶入婚禮月份、預算、travel 與 breakdown 相關欄位，避免回退到固定預設。
- PlanLabPanel decision template handler 增加 retirement guard（沿用既有 unavailable toast），並在可映射模板時傳入 scenario baseMonth 作為 month anchor。
- Plan Lab housing template split: `home_purchase` stays on the `life_home_purchase` bundle wizard path; `rental_plan` now reuses the only active-scenario rent event when present, otherwise it seeds a rent draft from the selected cost profile.
- Plan Lab「新增事件 > 住屋」在 create 模式僅保留租屋事件，避免與置業人生計劃路徑重疊；`rental_plan` 保持租金/按金/代理費預填，並更新置業成本提示文案為「先填樓價」。
- Overview KPI metric detail modal 參考 Boldin 資訊層次，補齊評級說明內容，並調整為 Action Items + Rating Scale。
- 移除 Read More/Learn More 區塊（目前未有文章內容），避免顯示空資訊入口。
- `zh-HK` KPI detail 區塊標題與評級文案統一為中文，避免中英混雜。

- Architecture Delta Log
  - Date: 2026-03-09
  - Changed modules: `apps/web/app/(marketing)/_components/PersonaBannerSection.tsx`, `apps/web/app/(member)/member/cases/page.tsx`, `apps/web/app/(member)/member/components/CasesList.tsx`, `apps/web/app/(member)/member/components/CaseDialogs.tsx`, `apps/web/src/features/member/createCaseEntry.ts`, `apps/web/messages/en.json`, `apps/web/messages/zh-HK.json`, member preset tests.
  - Data-flow impact: marketing persona CTA query -> member cases searchParams parsing -> client create dialog state initialization; no engine/domain persistence changes.
  - Backward compatibility: login redirect destination remains `/{locale}/member/cases`; invalid query values are ignored and default blank create flow remains.
  - Risk & rollback: low UI-routing risk; rollback by removing query parsing module + passing no entryIntent so member create dialog returns to prior behavior.
  - Date: 2026-03-09
  - Changed modules: `apps/web/features/planLab/decisionTemplates.ts`, `apps/web/features/planLab/decisionSummary.ts`, `apps/web/features/planLab/PlanLabPanel.tsx`, `apps/web/features/planLab/__tests__/decisionTemplates.test.ts`, `apps/web/features/planLab/__tests__/PlanLabPanel.test.tsx`, `apps/web/src/domain/planLab/types.ts`, `docs/product/IMPLEMENTATION_STATUS.md`, `docs/product/DECISIONS.md`, `AGENTS.md`
  - Data-flow impact: `home_purchase` keeps scenario-scoped bundle wizard input; `rental_plan` launch is explicitly routed to active-scenario rent housing create/edit with scenario-scoped cost profile; compare summary only adds UI hint text and does not alter engine/domain calculations.
  - Backward compatibility: 未改 engine/domain public interfaces；income shock path 與既有 bundle apply path 保持不變。
  - Risk & rollback: If the new defaults feel off, revert the `buildBundleWizardInputForDecisionTemplate` / `buildHousingEventDraftForDecisionTemplate` mappings without touching stored scenario data.

- Onboarding v3 `Scenario basics` 新增「人生階段重點」多選（成家/生育/教育/退休），並依選擇顯示推薦模板清單（剛畢業/已婚/準退休分流）。
- 提交 onboarding 後將 persona 偏好寫入 `scenario.meta.personaFocuses`（scenario-scoped），後續可於 Plan Lab 比較區塊隨時切換，不鎖定路徑。
- Plan Lab Compare 的 Impact KPI 面板新增 persona-aware 預設排序：依焦點自動提升相關 KPI（例如教育焦點優先「教育成本壓力」）。
- 新增 `educationExpenseRatio` KPI（教育支出 ÷ 核心生活支出，12 個月視窗），並接入 Plan Lab KPI diff 卡片與文案。

## Latest Update (2026-03-08)
- Overview DashboardMetrics 已新增 4 個可由 projection + ledger 靜態推導 KPI：`savingsRate12m`、`expenseToIncomeRatio12m`、`debtToAssetRatio`、`netWorthGrowth12m`；在資料不足時回傳 `null`（不以 `0` fallback）。
- Overview KPI 卡片已加入上述 4 項指標，並新增對應 tooltip 公式說明（沿用 `overview.dashboard.kpi.*` i18n key）。
- `en` / `zh-HK` locale 已補齊新 KPI label/helper/tooltip key；並新增 metrics 單元測試覆蓋正常值、`null` 與負現金流極端值。
- Overview KPI `cashRunway` / `riskLevel` 卡片已綁定詳情 CTA（含 mobile carousel 可操作），可直接開啟對應詳情互動。
- 新增 KPI CTA 互動測試：驗證 mobile carousel CTA 可點擊、且 CTA 觸發後 detail 狀態（modal host）開啟。
- Overview dashboard 新增 KPI watchlist：KPI 顯示改為 library（全部可用）+ watchlist（已選）兩層，預設保留核心指標；watchlist 編輯支援增刪/排序，並跟隨 active scenario 儲存避免跨 scenario leakage。
- Overview KPI watchlist drawer 的 library 卡片已新增「現時狀態」badge（沿用 health scorecard status），讓使用者在編輯清單時可即時判讀每個 KPI 當前健康度。
- 新增互動測試覆蓋 watchlist 持久化：更新後經 hydrate/reload 仍保留，且不影響其他 scenario。
- Overview dashboard 新增 KPI health scorecard：以 domain classification 模組統一計算 excellent/progressing/vulnerable/informational/no-data，並在 KPI 卡與分佈條共用 i18n status key。
- 新增 health scorecard domain 單元測試，覆蓋 KPI 分級規則與分佈計數。
- Overview KPI 顯示改為統一 null-safe formatter：`avgNetCashflow12m`、`avgNonSalaryIncome12m`、`avgFunBudget12m` 遇到 `null` 顯示 `dashboard.common.emptyValue`，不再以 `0` 代替；對應 scorecard 同步標示為 `no-data`。
- OverviewClient KPI formatter 進一步統一：所有 KPI 數值遇到 `null/NaN` 都回傳 `dashboard.common.emptyValue`；比率型 KPI 在分母為 `0` 時由 metrics 回傳 `null`，前端不再顯示 `0.0%`。
- 新增 formatter 單元測試，覆蓋 `null / 0 / 負值` 顯示與 score status 行為。
- `metrics.test.ts` 新增「無資料顯示空值」與「比率分母為 0 回傳 null」斷言，覆蓋 `avgNetCashflow12m`、`avgNonSalaryIncome12m`、`avgFunBudget12m` 與比率型 KPI。
- `zh-HK` locale 已清理 overview 與 Plan Lab/health summary 的可翻譯術語（例如 Baseline/Scorecard/proxy），並保留 `Plan Lab` 品牌詞一致寫法。
- 新增 `src/i18n/__tests__/zhHKLocaleLint.test.ts`：檢查 `overview.*` 與 `en` 的 placeholder token 對齊，並掃描可疑未翻譯英文詞，避免回歸。
## 已存在但未進主流程
- Scenario presets/seeds 已接入 member 建案例入口作為 onboarding-prefill v1；app 內延伸入口與分組資訊架構仍待產品化。
- Plan Lab 已有實驗與比較骨架，但常見決策模板與結論導向輸出仍需產品化。
- Cloud save/revision conflict 已可運作，仍需把「首次建模 -> 長期回訪」路徑整合成更低摩擦流程。

## 真正阻塞上市
- Onboarding 與 property bundle 的體驗仍未形成一致、低摩擦的首次建模流程。
- Guardrails 未形成可量化 completeness 與明確修正建議，影響用戶信任。
- 可行動結論頁不足，使用者較難快速理解決策差異與下一步。
- 市場入口與示例旅程未完整對接現有產品能力，導流轉化風險高。

## Quality Gates Baseline (2026-03-07)
| Command | Status | Notes |
|---|---|---|
| `pnpm -w lint` | PASS | 全 workspace lint 通過 |
| `pnpm -w typecheck` | PASS | 全 workspace typecheck 通過 |
| `pnpm -w test` | PASS (WARN) | 測試全綠；有非阻斷 stderr/console 訊息與 turbo outputs 警告 |
| `pnpm -w --filter web build` | PASS (WARN) | build 成功；有 webpack cache big strings 非阻斷警告 |

## 可觀測性基線（Market Entry Funnel v1）

### 事件層（client-side）
- `market_landing_view`
  - 定義：進入 marketing landing page 時記錄一次曝光。
  - 最小 payload：`locale`, `journeyId`, `presetId`, `isSignedIn`。
- `journey_cta_click`
  - 定義：點擊 persona banner CTA（含 journey + preset deep-link 意圖）。
  - 最小 payload：`locale`, `journeyId`, `presetId`, `isSignedIn`。
- `auth_modal_open`
  - 定義：由 marketing CTA 開啟登入/註冊 modal。
  - 最小 payload：`locale`, `journeyId`, `presetId`, `isSignedIn`。
- `preset_create_started`
  - 定義：member/cases create dialog 進入 preset flow（含 journey entry intent 或手動選 preset）。
  - 最小 payload：`locale`, `journeyId`, `presetId`, `isSignedIn`。
- `preset_create_submitted`
  - 定義：create-case 送出且採用 preset。
  - 最小 payload：`locale`, `journeyId`, `presetId`, `isSignedIn`。
- `onboarding_started`
  - 定義：preset 建立後導向 onboarding 前記錄起點。
  - 最小 payload：`locale`, `journeyId`, `presetId`, `isSignedIn`。

### 目前可量測漏斗定義
1. `market_landing_view`
2. `journey_cta_click`
3. `auth_modal_open`（僅未登入分支）
4. `preset_create_started`
5. `preset_create_submitted`
6. `onboarding_started`

### 指標口徑（v1）
- Landing → Journey CTA CTR = `journey_cta_click` / `market_landing_view`
- Journey CTA → Preset Start = `preset_create_started` / `journey_cta_click`
- Preset Start → Submit CVR = `preset_create_submitted` / `preset_create_started`
- Preset Submit → Onboarding Start CVR = `onboarding_started` / `preset_create_submitted`

### Guardrails
- 只記錄 funnel observability metadata，不持久化 scenario/case 業務狀態。
- `journeyId` / `presetId` 允許 `null`，避免強制推斷與誤寫流程狀態。
- tracking abstraction 不耦合特定供應商，後續可用 runtime adapter 接既有 telemetry pipeline。

## Latest Delta (2026-03-08)
- Plan Lab 決策模板擴展為 5 類家庭決策（結婚、生育、育兒、買屋/租樓、退休）+ income shock；每個模板新增「本地常見成本範圍」區塊、三檔預設（保守/中位/進取）與差異來源說明，並提供「為何這樣估算」tooltip 教學。
- 使用者所選成本檔位已寫入 `scenario.meta.planLab.decisionTemplateCostProfile`，僅作用於當前 active scenario 並跟隨既有 scenario meta 持久化/hydrate。
- Onboarding v3（收入/支出步驟）已加入每筆手動項目的分類 dropdown，並顯示分類摘要；沿用既有 `money` category i18n keys 與 taxonomy，不改 engine/interface。
- Event mapping 保留使用者在 onboarding 所選分類（若有），僅在未指定時套用原 onboarding tag 預設。
- 修正 onboarding v3 draft storage 測試基線：`dual-income-rental` 種子情境在遷移後 `mortgageRatePct` 應為 `3.25`（與 seed housing payload 一致），避免 quality gate 被過期預期值阻塞。
- Overview KPI i18n 對齊：`overview.dashboard.kpi.scopeHorizon`、`overview.dashboard.kpi.notReachedWithinHorizon` 的 `en` 文案已改為英文，同時確認與 `zh-HK` placeholder token（`{endMonth}`、`{years}`）一致且無 drift。
- Overview KPI 健康分層統計改為以完整 KPI library 計算（不再只統計 watchlist 已選項），`healthScorecard.total` 亦同步顯示全量 KPI 數；`zh-HK` 補齊 `nonSalaryIncomeRatio`、`passiveIncomeCoverage`、`assetLinkedExpenseRatio` 及公式文案，避免非品牌英文 fallback 混入。
- Overview KPI 卡片「查看可支撐月數 / 查看風險說明」CTA 改為使用 `overview.*` 命名空間翻譯（`t(...)`），修正先前誤用 `overview.dashboard.*` 導致 zh-HK 顯示英文 fallback（`View runway details` / `View risk details`）。
- Overview `cashRunway` 與 `riskLevel` KPI 已改為與 detail modal 共用同一來源（`computeRunwaySimulation` + `computeRiskAssessment`）：卡片顯示值與 modal 計算一致，避免卡片/說明出現高低矛盾。
- Overview KPI watchlist 全卡片已支援統一 `Metric overview` modal（Action Items / Rating Scale / Learn More）；同時 `riskLevel` 與 `cashRunway` badge 分級與 runway 36/18 月門檻對齊，修正「低風險但顯示需關注」認知落差。

## Next Recommended Priority
1. 以「可完成一次重大家庭決策」為目標，收斂 Onboarding + Property Bundle 旅程。
2. 讓 Plan Lab 以模板化決策入口驅動，並補齊比較摘要的可行動建議。
3. 將 member preset onboarding-prefill 延伸到 app 內延伸入口，並建立封閉 beta 回饋閉環與量化追蹤。
## Latest Update (2026-03-20)
- Onboarding v3 housing/property guardrails severity 已完成首輪 calibration：`mortgage_core_fields_missing`、`self_use_rental_conflict` 保留為 blocking `critical`；`property_usage_missing`、`rental_property_income_missing`、`mortgage_property_basics_missing` 維持 `warning`；duplicate 類則維持 `warning` / `info`，避免把高誤報風險提醒包裝成阻礙提交。
- Guardrail summary level 現以 blocking 規則為 `critical` 判準；只有 info 類 duplicate reminder 時維持 `clear`，讓 review UI / analytics 更貼近真實提交風險。
- Focused tests 已補強 severity matrix 與 summary aggregation，確保規則仍保有 `id / severity / message key / action hint / target step/section` 契約且不引入 engine 依賴。
- Onboarding guardrails v1 已建立獨立 rules layer：每條規則都定義 `id / severity / message key / action hint / target step/section`，並輸出 UI 可直接消費的 guardrail summary model。
- 首批規則聚焦 housing/property 常見錯誤，覆蓋 `key_missing / obvious_conflict / basic_inconsistency / potential_double_counting` 四類：物業用途缺漏、按揭核心欄位缺漏、自住/出租衝突、出租物業租金缺漏、按揭與物業基本值不一致、以及可能重複輸入住屋支出。
- Guardrail 規則層只讀 active onboarding draft + active scenario context，不依賴 engine，也不做任何跨 scenario 讀寫或持久化捷徑。
- 新增 focused unit tests，覆蓋關鍵缺漏、明顯衝突、基本不一致、潛在重複計算，以及 scenario fallback 路徑，確保每條 guardrail 都附帶可行動修正方向。
- Onboarding completeness score v1 已拆成獨立 rules layer：以家庭結構、收入、固定支出、住屋資訊、資產 / 負債基本值 5 組輸入，輸出 `ready / needs_attention / incomplete` summary model，供 review / 後續 UI 直接消費。
- Score 規則只讀 active onboarding draft 與 active scenario context，並透過 property-derived cashflow/liability 規則補齊住屋訊號；不讀 engine、不改 projection 介面。
- 收入完整度會刻意把自動建議薪資（auto salary suggestion）視為 `needs_attention` 而非 `ready`，避免預設建議值讓首次建模看似已完成。
- 新增 focused unit tests，覆蓋空白草稿、租屋 ready、按揭資料未齊的 owned-home、以及 scenario context fallback 等規則路徑。
- Onboarding v3 資產步驟已加入 housing/property IA 引導：先提示「現時租屋請到支出填寫、此步驟只填已持有物業」，再以 section grouping 分開物業基本資料、物業現金流、按揭資料，降低無關欄位同時出現的認知負擔。
- 自住物業／出租物業／有按揭／無按揭文案已收斂為明確 label + helper text；按揭利率與投資回報等百分比欄位補上 direction 說明，並以 `recommended` / `optional` badge 提示填寫優先序。
- Review step 已加入 property / mortgage 摘要鋪位，讓使用者在提交前可快速確認自己填的是哪一種 housing scenario 與是否已填按揭資料。
- 本次變更聚焦 onboarding review/completeness 規則層與 i18n，不改 compiler、engine、post-login routing 或 persistence schema。

## Latest Update (2026-03-20)
- Onboarding v3 review / submit step 現已把 completeness score、群組狀態與 guardrail summary 整合為同一個提交前摘要，使用者可在送出前看懂 readiness 並逐項返回對應 step 修正。
- Review guardrails 現已提供 per-item fix CTA，並補上 `onboarding_review_viewed`、`guardrail_shown`、`guardrail_fixed`、`onboarding_completed` funnel analytics；payload 僅含 locale、層級、數量、rule/step metadata，不含任何金額或 scenario business payload。
- Submit / cloud-save 流程現已提供 `validating` / `saving` / `redirecting` 明確回饋與 loading overlay，降低最後一步「有沒有儲存到」的不確定感。
- Canonical scenario onboarding route 新增 dedicated loading skeleton，避免從 member/app 進入 onboarding 時出現白屏。
