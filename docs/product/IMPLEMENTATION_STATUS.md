# North Star Implementation Status
Last updated: 2026-03-08 (zh-HK overview/plan-lab locale lint)

## Readiness Baseline
| 指標 | 分數 | 說明 |
|---|---:|---|
| Core infra readiness | 70% | auth/cloud save、scenario persistence、核心路由與 quality gates 已可運行 |
| Closed Beta readiness | 58% | 核心能力存在，Plan Lab 模板入口與摘要層已前進主流程，但 onboarding/guardrails 仍待整合 |
| Public MVP readiness | 38% | 可行動摘要層已有最小可用品質，但 market entry 與營運支援仍有明顯缺口 |

## Capability Matrix
| 能力模組 | 進度 | 現況 | 上市缺口 |
|---|---:|---|---|
| Onboarding + Property Bundle | 68% | 已有家庭/收入/支出/物業/按揭欄位與流程骨架，且 v3 收入/支出手動列可直接確認分類並顯示分類摘要 | 需補齊既有物業 household 的一致輸入與審核體驗與 completeness guardrails |
| Plan Lab 決策化 | 72% | 已接入 3 類決策模板（置業/生育/收入衝擊）與模板可用性 guard；實驗群組與保存流程維持一致 | 尚缺利率上升/換樓等後續模板與模板成效校準 |
| Persistence / Auth | 81% | case/scenario, cloud save, revision conflict, and dev-only E2E auth bootstrap/reset are in place | Still needs tighter onboarding/preset/compare integration and CI coverage |
| Guardrails / Completeness | 40% | 已有部分 warning 與檢查邏輯 | 需產品化 completeness score、關鍵警示與修正引導 |
| Actionable Output | 61% | 已加入 Plan Lab 決策摘要（風險節奏/方向、正負 driver、下一步建議）；Overview 新增 KPI health scorecard 與 scenario-scoped KPI watchlist（可增刪/排序並持久化） | 仍需擴展到跨頁輸出與可下載/可分享格式 |
| Preset ???? | 58% | member ??? modal ??? blank/preset create mode?preset ? onboarding-prefill ???? 6 ???? seeds?seed ?? i18n ??????? raw keys | app ????????????? beta ???????? |
| GTM / 營運就緒 | 20% | 有 marketing pages 基礎 | 缺 sample journey 導流、beta feedback loop、支援流程 |


## Latest Update (2026-03-08)
- Overview DashboardMetrics 已新增 4 個可由 projection + ledger 靜態推導 KPI：`savingsRate12m`、`expenseToIncomeRatio12m`、`debtToAssetRatio`、`netWorthGrowth12m`；在資料不足時回傳 `null`（不以 `0` fallback）。
- Overview KPI 卡片已加入上述 4 項指標，並新增對應 tooltip 公式說明（沿用 `overview.dashboard.kpi.*` i18n key）。
- `en` / `zh-HK` locale 已補齊新 KPI label/helper/tooltip key；並新增 metrics 單元測試覆蓋正常值、`null` 與負現金流極端值。
- Overview KPI `cashRunway` / `riskLevel` 卡片已綁定詳情 CTA（含 mobile carousel 可操作），可直接開啟對應詳情互動。
- 新增 KPI CTA 互動測試：驗證 mobile carousel CTA 可點擊、且 CTA 觸發後 detail 狀態（modal host）開啟。
- Overview dashboard 新增 KPI watchlist：KPI 顯示改為 library（全部可用）+ watchlist（已選）兩層，預設保留核心指標；watchlist 編輯支援增刪/排序，並跟隨 active scenario 儲存避免跨 scenario leakage。
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

## Latest Delta (2026-03-08)
- Onboarding v3（收入/支出步驟）已加入每筆手動項目的分類 dropdown，並顯示分類摘要；沿用既有 `money` category i18n keys 與 taxonomy，不改 engine/interface。
- Event mapping 保留使用者在 onboarding 所選分類（若有），僅在未指定時套用原 onboarding tag 預設。
- 修正 onboarding v3 draft storage 測試基線：`dual-income-rental` 種子情境在遷移後 `mortgageRatePct` 應為 `3.25`（與 seed housing payload 一致），避免 quality gate 被過期預期值阻塞。
- Overview KPI i18n 對齊：`overview.dashboard.kpi.scopeHorizon`、`overview.dashboard.kpi.notReachedWithinHorizon` 的 `en` 文案已改為英文，同時確認與 `zh-HK` placeholder token（`{endMonth}`、`{years}`）一致且無 drift。
- Overview KPI 健康分層統計改為以完整 KPI library 計算（不再只統計 watchlist 已選項），`healthScorecard.total` 亦同步顯示全量 KPI 數；`zh-HK` 補齊 `nonSalaryIncomeRatio`、`passiveIncomeCoverage`、`assetLinkedExpenseRatio` 及公式文案，避免非品牌英文 fallback 混入。

## Next Recommended Priority
1. 以「可完成一次重大家庭決策」為目標，收斂 Onboarding + Property Bundle 旅程。
2. 讓 Plan Lab 以模板化決策入口驅動，並補齊比較摘要的可行動建議。
3. 將 member preset onboarding-prefill 延伸到 app 內延伸入口，並建立封閉 beta 回饋閉環與量化追蹤。
