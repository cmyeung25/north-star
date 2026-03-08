# North Star Product Roadmap
Last updated: 2026-03-08

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
- [x] Onboarding v3 收入/支出手動項目新增分類 dropdown（沿用既有 taxonomy），並在卡片顯示分類摘要以降低誤分類。
- [x] Onboarding v3 收入/支出步驟分類摘要改用與 Money 頁一致的 `MoneyMetaTags` 樣式，並修正家庭成員自動薪資事件預設分類為 salary（避免落入「其他」）。
2. Plan Lab 決策模板化
- 將常見決策（生育、收入衝擊、利率上升、置業/換樓）變成可直接套用的實驗模板。
- 支援 baseline vs experiment 比較與保存。
- [x] v1 已交付：`home_purchase`、`new_baby`、`income_shock` 三類模板已接入「新增實驗」入口，並沿用既有 patch/group 流程（不污染 baseline）。
- [x] v1 已交付：新增最小可用決策摘要層（risk timing/trend、top drivers、recommended actions），以 KPI 差值 heuristic 產生（不改 engine）。
- [ ] 下一批模板：利率上升與換樓模板，待 beta 回饋後定義預設 payload 與入口優先序。
3. Guardrails / Completeness 層
- 建立 completeness score 與關鍵警示（缺漏、重複計算、物業自住/出租衝突、按揭欄位不一致）。
4. Presets 接入主流程
- [x] v1 已交付：member/cases「建立案例」支援 blank / preset create mode；preset 以 onboarding-prefill 方式接入，不直接建立已完成 scenario。
- [x] v1 已交付：member 入口 preset allowlist 擴至 6 個產品化 seeds（single-renter、dual-income-home、dual-income-rental、new-baby、new-baby-helper、high-asset）。
- [ ] app 內延伸入口與分組資訊架構待後續 beta 回饋收斂。
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
- [x] Overview `cashRunway` / `riskLevel` KPI 卡加入詳情 CTA，並可於 mobile carousel 觸發對應詳情互動（runway/risk）。
- [x] Overview KPI `avgNetCashflow` / `avgNonSalaryIncome` / `avgFunBudget` 已改為 null-safe 顯示：`null` 顯示 emptyValue，並與 scorecard 的 `no-data` 對齊。
2. Market Entry + Sample Journey
- 上線市場入口頁（價值主張、適用族群、示例旅程）。
- 提供可直接體驗的家庭場景範本與引導。
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

## Phase C: Post-MVP Deferred
### 延後項目
- Full Monte Carlo 模擬。
- 自動銀行/投資帳戶同步。
- 深度 advisor / firm-level 管理能力。

### 延後原則
- 以上項目僅在 MVP 留存與決策完成率達標後才排入實作。
- 不得以延後項目作為阻擋 Closed Beta 或 Public MVP 的前置條件。
