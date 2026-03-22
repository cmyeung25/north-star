# North Star Implementation Status
Last updated: 2026-03-22 (weekly product analytics decision memo refreshed for 2026-03-09 → 2026-03-16 UTC)

## Readiness Baseline
| 指標 | 分數 | 說明 |
|---|---:|---|
| Core infra readiness | 70% | auth/cloud save、scenario persistence、核心路由與 quality gates 已可運行 |
| Closed Beta readiness | 78% | 核心能力存在，Plan Lab 模板入口與摘要層已前進主流程，onboarding housing/property IA 已更清晰，且 review / submit 前已可看到 completeness + housing/property guardrails summary、severity 分組、返回修正入口、較低壓力的 guardrail 文案與提交回饋；本輪再把「onboarding complete → overview baseline → Plan Lab 第一次重大決策比較」補成同一條主路徑：Overview 會在 baseline ready 且無 recovery banner 時顯示第一次比較 CTA，並直接把使用者帶入 Plan Lab decision-template mode 與推薦模板 |
| Public MVP readiness | 50% | 可行動摘要層已有最小可用品質；market entry 訊息架構已較一致，sample journey impression / case created 事件與 market-entry weekly review ritual 已補齊，且 onboarding funnel 已有 review / guardrail / completion 事件、operator-ready weekly review pack、固定 weekly workflow 與 guardrail locale parity lint。惟按 PR1 固定好的 weekly artifacts 重跑當前與上一個完整週窗（2026-03-09 → 2026-03-16 UTC、2026-03-02 → 2026-03-09 UTC）後，repo / internal export 環境仍未取得實際 onboarding review 與 market-entry cohort 事件，因此 readiness 仍受「缺少真實週報證據」限制。 |

## Capability Matrix
| 能力模組 | 進度 | 現況 | 上市缺口 |
|---|---:|---|---|
| Onboarding + Property Bundle | 78% | 已有家庭/收入/支出/物業/按揭欄位與流程骨架；housing/property IA 先區分「現時租屋 vs 已持有物業」，再分流自住／出租／按揭欄位與 review 摘要。onboarding draft → v3 asset/compiler 映射現已對齊：down payment 百分比不再因 custom mortgage base 翻轉語意、`usage` / 租金 fallback 更一致、0 principal 不再生成假按揭資料；guardrails v1 亦已覆蓋 housing/property 最常見錯誤。 | 需補齊既有物業 household 的一致輸入與更完整的 review 修正入口 |
| Plan Lab 決策化 | 88% | 已接入 3 類決策模板（置業/生育/收入衝擊）與模板可用性 guard；並已把模板成本檔位（保守/中位/進取）對應到人生事件 wizard 初始值，實驗群組與保存流程維持一致。本輪把 deferred `mortgage_rate_hike` / `move_home` 補到 beta-ready：title / description / disabled reason / estimate guide / cost-profile 文案齊備，launcher 只會讀 active scenario editable baseline housing/mortgage event，payload 亦已校準為較高按揭利率草稿與較後住屋時點草稿，且仍只經既有 Plan Lab patch / experiment-group 流程。Overview → Plan Lab 入口亦維持 allowlisted route intent 與推薦模板 | 尚缺 rollout gate evidence：只有 onboarding start rate 與 onboarding review → completed conversion 在兩個完整週窗都穩定達標後，才可開啟環境 flag 讓 deferred 模板曝光 |
| Persistence / Auth | 81% | case/scenario, cloud save, revision conflict, and dev-only E2E auth bootstrap/reset are in place | Still needs tighter onboarding/preset/compare integration and CI coverage |
| Guardrails / Completeness | 96% | 已有 assumptions / Plan Lab 局部 warning；onboarding completeness score + guardrails v1 現已接入 review / submit UX，使用者可在提交前看到總體完整度、overall guardrail summary、依 severity 分組的 `critical / warning / info` 區塊、逐項返回修正入口與清晰 submit/save feedback；housing/property guardrails severity 已完成首輪 calibration，只有會扭曲 baseline 核心語意的規則維持 `critical`，重複輸入類則降為 `warning` / `info`。analytics contract 仍維持 operator-ready review-pack 版本：payload 只保留 metadata allowlist，並新增安全的 `reviewSessionId` / `reviewSourceContext`、穩定的 `guardrail_fixed` 消失判準，以及可直接輸出 weekly summary / table JSON 的 builder + formatter。按 PR1 固定好的 weekly artifacts 比對當前與上一個完整週窗後，四條 priority rules（`property_usage_missing`、`duplicate_current_home_housing_costs`、`duplicate_rent_expense_inputs`、`mortgage_property_basics_missing`）的 show-rate、fix-success、review→completed conversion 全部維持 0.0% / 0.0% / 0.0%，但兩窗 review sessions 都是 0，所以結論只可判作「持平／無 support」，仍未足以宣稱改善、持平穩定或惡化。 | 仍需用下一個完整週窗的真實 review export 驗證本輪 copy/fix-path 校準是否真係降低 review drop-off；在 review sessions < 20 或單條 rule shown support < 5 前，不得把 guardrail 週報升級成產品決策。 |
| Actionable Output | 61% | 已加入 Plan Lab 決策摘要（風險節奏/方向、正負 driver、下一步建議）；Overview 新增 KPI health scorecard 與 scenario-scoped KPI watchlist（可增刪/排序並持久化） | 仍需擴展到跨頁輸出與可下載/可分享格式 |
| Preset 主流程整合 | 97% | 已產品化部分：member create modal blank/preset、marketing persona / sample journey → `/member/cases` canonical handoff、6 個 allowlist seeds、journey summary + ETA / outcome copy；app 內延伸入口現已上線三個 beta surfaces：scenario onboarding start / resume shell、overview/dashboard onboarding-recovery banner、以及 scenario settings → data-management reset。三者都重用同一套 allowlist、journey guidance / summary presenter 與 onboarding draft write path；copy rule 亦已明確拉開：onboarding / dashboard / settings 全部直接聲明自己不是 Plan Lab template / Money event create flow，dashboard 另有專屬 recovery heading + CTA，settings 則維持較克制的 restart / replace draft 語意與覆蓋警告。最新 decision memo 已把三個入口 confusion cross-check 擴展成 current vs previous window 對照，但兩窗都無實際 cohort / tagged beta feedback 證據，所以目前仍只可列為 beta watch item，而非已被真實 cohort 支撐的產品結論。 | 尚需把下一個完整週窗的真實 market-entry / onboarding export 與 tagged beta feedback 一齊交叉檢查，先可判斷 copy guard 是否足以壓低「誤把 preset 當 experiment / event create」的 confusion signal。 |
| GTM / 營運就緒 | 39% | 已有 marketing pages、sample journey -> member/cases 導流入口，且 landing IA 已重整為 hero → proof → persona → journey → CTA；sample journey impression、case created 成功事件、signed-in/out completion attribution 與固定 weekly review ritual 都已補齊。最新固定週窗（2026-03-09 → 2026-03-16 UTC）market-entry board 在目前環境為 0 landing / 0 journey click / 0 case created / 0 onboarding completed，因此 publishability decision 仍只可維持 `hold`。 | 仍缺 beta feedback loop、支援流程與真實 cohort 基線；未有連續兩個完整週窗的真實 traffic/export 前，不得宣稱 sample journey 已 ready to scale。 |

## Market Entry + Sample Journey Progress
| 子項 | 進度 | 現況 | 阻塞項 | 下一里程碑 |
|---|---:|---|---|---|
| 入口頁訊息架構 | 92% | landing 已重整為 hero proof、文字主導 persona cards、sample journey 決策問題與明確 final CTA handoff；sample journey card impression 現已在 section/card exposure path 量測。本輪再把 hero / persona CTA / sample journey summary 收斂到同一個 content-assembly experiment slot contract，可穩定切換 copy 與排序但不動 handoff contract。 | 仍缺 dashboard / review exports 與 sample-size-based rollout SOP | 把 experiment slot cohort 檢視接到固定週報 |
| Persona ↔ Preset Mapping | 85% | allowlisted journey ids、primary preset mapping、blank fallback 規則現已收斂到單一 canonical source，並同步供 member resolver、marketing CTA 與測試使用；文件亦補上 persona coverage matrix | 仍缺 secondary preset / unsupported persona 的產品評估流程與 KPI 校驗 | 建立未來 persona 擴充 review checklist（mapping / copy / funnel） |
| Journey Deep-link / Handoff | 96% | `journey + preset` query handoff 已統一由 helper/builders 管理；member 端嚴格只讀 `journey` / `preset`，未知值安全回退 blank flow，signed-out auth return 亦會回到 `/member/cases` 重建相同 intent；sample journey CTA 仍維持同一 contract，未引入 direct scenario shortcut。`onboarding_completed` 也已補進 metadata-only market-entry contract，讓 signed-in/out completion cohort 可固定輸出。 | 尚需用真實 cohort 驗證 completion attribution 與 export 是否足以支撐每週決策節奏 | 以兩個完整週窗驗證 board / export 的營運可用性 |
| Funnel Tracking | 96% | 已量測 landing / CTA / auth / preset create / onboarding start，且 onboarding review / guardrail / completed 已補上 vendor-agnostic funnel events；`sample_journey_impression`、`case_created` 已上線，payload allowlist 亦已擴充為 metadata-only `locale / journeyId / presetId / isSignedIn / experimentSlotKey / experimentVariant`，方便按 slot/variant 做 cohort review。此輪再補上 metadata-only `onboarding_completed` market-entry 事件與固定 weekly board/export。 | 尚待真實 traffic 驗證 attribution context 在 signed-out auth return 與多週期 cohort 下的穩定性 | 以兩個連續週窗驗證 market-entry board 的 publishability 決策品質 |
| A/B 文案實驗位 | 72% | hero value prop、persona CTA/summary、sample journey summary 已有穩定 slot key、variant naming rule（snake_case + `_v{n}`）與 default fallback；content assembly 只會改文案與排序，member handoff / preset allowlist / blank fallback 仍維持 canonical contract。 | 尚未建立 sample-size guard、stop rule 與營運切換 SOP | 建立 experiment review checklist（sample size / fallback / winner promotion） |
| KPI 基線 / 驗收門檻 | 68% | 已有 v1 funnel event 與基礎轉化公式；本輪再新增 review ritual 文件，明確定義 weekly cadence、cohort breakdown、minimum sample-size warnings 與 ready-to-scale 規則 | 尚缺真實 traffic baseline 與 dashboard automation | 以兩個連續週期累積 publishability baseline，之後再決定是否放大 traffic |

## Market Entry KPI Minimum Baseline (MVP gate)
| KPI | 最低門檻 | 現況 | 阻塞項 | 下一里程碑 |
|---|---:|---|---|---|
| 首次體驗完成率（landing → onboarding completed） | ≥ 20% | onboarding completed event 已可發送，但尚未形成 cohort dashboard 與 signed-in/out attribution 對照 | 缺跨 auth/session attribution 與週期檢視板 | 補上 completion cohort dashboard 與 attribution 規格 |
| Journey 點擊 → 建立案例轉化率 | ≥ 35% | 已可量測 `journey_cta_click` → `preset_create_submitted`，且 sample journey CTA 與 persona CTA 現使用同一事件語意 | 缺 persona 分群 benchmark，未知哪些 journey 文案最弱 | 依 review ritual 建立 persona/journey cohort breakdown |
| Onboarding 啟動率 | ≥ 85% | 已可量測 `preset_create_submitted` → `onboarding_started` | 尚未確認 signed-out auth return path 對啟動率的影響 | 比較 signed-in / signed-out 兩條 handoff 漏斗 |
| Landing → Journey CTA CTR | ≥ 12% | 已有基礎 CTR 公式，且 review ritual 已定義 sample-size warning 與 signed-in/out cohort 比較 | 缺 CTA placement / copy 實驗位與 dashboard automation | 建立週報 export / CTA copy experiment plan |
| Case created → Onboarding completed 流失差 | < 25 個百分點 | `case_created` 與 market-entry `onboarding_completed` 現已可在固定 weekly board / export 共同檢視，並拆開 signed-in / signed-out delta 與 journey↔preset pair drop-off。 | 缺真實 cohort 基線與兩個連續週窗的穩定比較 | 先跑兩週 drop-off report，再決定是否可 scale traffic |

## Latest Update (2026-03-22)
- Plan Lab deferred decision templates `mortgage_rate_hike` / `move_home` 已由「contract / gated」推進到「beta-ready / gated rollout」：兩張卡的文案、estimate guide、cost-profile 說明與 disabled reason 已可直接給 beta 使用者閱讀，不再只是 placeholder。
- launcher / payload contract 已再確認：`mortgage_rate_hike` 只會打開 active scenario 的 editable baseline mortgage housing event，並預填較高利率草稿（+0.75 / +1.5 / +2.5 厘）；`move_home` 只會打開 active scenario 的 editable baseline housing event，並預填較後住屋時點草稿（+6 / +12 / +18 個月）。兩者都 fail closed，不會 invent data，也不會寫 baseline。
- rollout 仍然維持 gated：只有當 onboarding start rate ≥ 85%，且 onboarding review → completed conversion 在兩個連續完整週窗都有足夠 support（review sessions ≥ 20，並通過 locale skew / support confidence 檢查）時，才可於環境層打開 `NEXT_PUBLIC_FF_PLANLAB_DEFERRED_DECISION_TEMPLATES`；未達標前 user-facing picker 仍保持 hidden。
- 主要風險已由「產品契約未定」轉為「evidence 未到位」：若真實 weekly export 仍不足，就算文案與 payload 已 beta-ready，也不可提早 expose；回滾方式仍是保持 feature flag 關閉。

- 已按 `docs/product/ONBOARDING_GUARDRAIL_WEEKLY_REVIEW_WORKFLOW.md` 與 `docs/product/MARKET_ENTRY_REVIEW_RITUAL.md` 的固定規則，重新跑上一個完整 Monday → Monday UTC 週窗：**2026-03-09 00:00 UTC → 2026-03-16 00:00 UTC**，並把結果整理成單頁 decision memo（`docs/product/WEEKLY_PRODUCT_ANALYTICS_DECISION_MEMO.md`）。
- aggregate + locale pack 仍由 `apps/web/src/lib/analytics/onboardingReviewPack.ts`、`marketEntryReviewBoard.ts`、`weeklyProductAnalyticsDashboard.ts` 統一輸出；required cohort 維度（signed-in / signed-out、journey / preset、journey↔preset、experiment slot / variant）依然保留在 board schema，但目前環境該窗沒有任何可用事件，因此所有 cohort rows 皆為空。
- onboarding review evidence：aggregate review sessions = 0、`en` locale pack = 0、`zh-HK` locale pack = 0；以 PR1 固定 artifacts 對照上一個完整週窗（2026-03-02 → 2026-03-09 UTC）後，四條固定 priority guardrails（`property_usage_missing`、`duplicate_current_home_housing_costs`、`duplicate_rent_expense_inputs`、`mortgage_property_basics_missing`）的 show-rate、fix-success、review→completed conversion 都只可記為 0.0% / 0.0% / 0.0%，趨勢判讀一律是「持平／無 support」，依 workflow 規則只能標記為 observation only，不能升級成 severity / copy 決策。
- market-entry evidence：landing views / journey clicks / case created / onboarding completed 全部為 0，signed-in vs signed-out delta 無法計算，review-board decision 只能維持 `hold`。現時最清楚的 blocker 已由「公式 / export 未齊」轉為「未有真實完整週窗 cohort export」。
- app preset recovery confusion cross-check：onboarding start/resume、overview recovery banner、settings data-management recovery 三個入口在 current / previous 兩個固定週窗都沒有 onboarding 或 market-entry cohort 證據、亦無 tagged beta feedback 可供交叉驗證，因此「mental-model 混淆是否持續出現」仍只可列為 heuristic watch item；下一輪必須把真實 weekly export 與 tagged beta feedback 一起看，先可做產品判斷。


## Latest Update (2026-03-21)
- Overview baseline-ready surface 現已新增「第一次重大決策比較」卡片：只有當 active scenario 已完成 baseline 且沒有 onboarding recovery banner 時顯示，避免與 recovery / preset flow 混淆。
- CTA 會以 allowlisted route intent（`openDecisionTemplates=1` + optional `decisionTemplate=<allowlisted-id>`）帶使用者進入 Plan Lab decision-template mode，未知 template id fail closed，不會暴露 hidden template 或直接套用實驗。
- 推薦模板目前只根據 active scenario 的 persona focus + housing baseline heuristic 決定（retirement / childbirth / parenting / home_purchase / income_shock / rental_plan），屬 UI 導航層，不新增 persistence、analytics payload 或 baseline write path。
- 已按兩個完整週窗的 onboarding review evidence，對四條 fixed priority guardrails（`property_usage_missing`、`duplicate_current_home_housing_costs`、`duplicate_rent_expense_inputs`、`mortgage_property_basics_missing`）再做一輪 focused UX calibration：文案更直接講清「現居路徑 / 物業定位 → 為何會影響 baseline → 下一步返邊度修」，避免高出現率被誤會成 blocking 錯誤。
- onboarding review 的 `warning / info` 區塊說明再收斂：明確保留「通常唔阻擋提交」語氣，同時更聚焦 current-home / property-path ambiguity，與 weekly review workflow 的 remediation order（copy → action hint → target clarity → severity review）對齊。
- 三個 preset recovery surfaces（onboarding start/resume、overview/dashboard recovery、scenario settings/data management reset）本輪已再拉開 copy：全部會直接聲明自己不是 Plan Lab experiment 或 Money event create/edit flow；dashboard 另加 recovery 專用 heading / CTA，settings 保持較克制的 reset 語氣。
- source-guard 測試維持不變，但本輪再補強文字 guard：若使用者只係想新增事件或試 Plan Lab 假設，copy 會清楚引導「呢度唔係嗰條路」，減少 app 內三個 recovery surfaces 與 sandbox / baseline create flow 心智模型混淆。

## Latest Update (2026-03-21)
- onboarding guardrail weekly review workflow 現已固定：`apps/web/src/lib/analytics/onboardingReviewPack.ts` 新增上一個完整週窗 helper 與 workflow builder，可同時輸出 aggregate + locale packs、四條 priority guardrail focus rows，以及 sample-size / locale-bias / external persona-bias 檢查結果。
- weekly dashboard / export productization 已上線最小產品版：新增 `apps/web/src/lib/analytics/marketEntryReviewBoard.ts`、`weeklyProductAnalyticsDashboard.ts` 與 `/{locale}/debug/weekly-review` internal board，固定輸出 onboarding 與 market-entry 兩塊 weekly dashboard，並提供 JSON / CSV export。
- market-entry funnel 現已把 `onboarding_completed` 補進 metadata-only contract，且透過 `marketEntry.ts` 的 local attribution context 把 experiment slot metadata 從 marketing CTA 持續帶到 member create / onboarding completion，讓 signed-in / signed-out handoff 與 experiment slot cohort 可在同一固定 board 檢視。
- 固定 priority guardrails 為 `property_usage_missing`、`duplicate_current_home_housing_costs`、`duplicate_rent_expense_inputs`、`mortgage_property_basics_missing`；預設 remediation order 亦正式化為 copy → action hint / target section clarity → severity review only if baseline risk persists。
- 由於 onboarding review analytics 仍維持 metadata-only allowlist，workflow 會明確把 persona / preset / journey distortion 標記為「必須回看 market-entry board」而非直接從 onboarding pack 推論，避免單一 acquisition mix 扭曲產品判斷。
- blocker / readiness 判讀已更新：若週窗 review sessions < 20 或單條 rule shown support < 5，只能記錄 observation，不可直接升級為產品決策；因此現階段 blocker 信心較前清晰，但仍需至少兩個完整週窗的真實 cohort 佐證。

## Latest Update (2026-03-21)
- scenario settings → data-management reset beta entry 3 已上線：在 Data Management 內新增 guarded preset recovery 區塊，沿用既有 member/onboarding/dashboard 驗證過的 six-seed allowlist、shared journey summary presenter 與 onboarding draft write path。
- settings surface 文案刻意保持較克制：只有進入 Data Management / reset surface 才會看到入口；無既有 draft 時採較輕量的「start from preset」語意，有既有 draft 時才顯示 replace warning 與 replace CTA，並再次明示這只會取代 active scenario 的 onboarding draft 起點、然後返回 onboarding 確認，不會直接寫 baseline event 或標記 onboarding complete。
- Data Management i18n（en / zh-HK）已同步更新：tab microcopy、section subtitle、settings-specific preset recovery copy 與 redirecting feedback 全數改走翻譯 key，避免沿用 dashboard 或 marketing CTA 語氣。
- source-guard 測試現已擴充到第三個 settings helper：除 onboarding / dashboard recovery 外，settings data-management recovery 也被鎖定不得出現在 Plan Lab Add Experiment、Money add-event/template picker、或多個 baseline event create/edit drawers。

## Latest Update (2026-03-21)
- overview/dashboard onboarding recovery beta entry 2 已上線：當 active scenario 在 dashboard 仍顯示 onboarding recovery gaps 時，overview 會顯示 recovery banner + preset suggestions；CTA 沿用既有 onboarding draft write path，建立 / 取代 scenario-scoped onboarding draft 起點後立即返回 onboarding 繼續補完。
- dashboard recovery banner 直接沿用入口 1 已驗證的 preset allowlist、journey guidance summary、replace warning 與 CTA 語意，沒有再建立 app-specific preset 規則或額外 analytics payload。
- 本輪補上第二層 source-guard 測試：除 onboarding helper 外，dashboard recovery banner 也被鎖定不得出現在 Plan Lab Add Experiment、Money add-event / template picker、或 baseline event drawers。
- 完成 preset 入口現況盤點：目前唯一產品化 preset entry 仍是 `/{locale}/member/cases` create dialog；其 journey guidance（audience / goal / ETA / outcome）與 canonical `journey + preset` handoff contract 保持不變，app 內尚未有正式上線入口。
- 補完 app 內延伸入口 IA contract，並把三個最合理承接同一 onboarding-prefill 心智模型的 surface 文件化為 beta 候選：`scenario onboarding start / resume`、`overview/dashboard onboarding-incomplete recovery`、`scenario settings → data management reset`。
- 三個 beta 候選入口的共同結論已收斂為同一句產品心智模型：**只為 active scenario 建立 / 取代 scenario-scoped onboarding draft 起點，然後回到 onboarding 完成確認；不直接寫 baseline、不標記 onboarding 完成、不改登入後先到 `/member/cases` 的規則。**
- 文案 / IA 分層也已定義：onboarding start / dashboard recovery 入口需要 journey guidance、ETA、outcome copy；settings reset 入口只保留較節制的 restart / replace draft copy 與覆蓋警告，避免被誤解為一般 quick action。
- 反混淆 guardrail 已文件化：preset suggestions 不得嵌入 Plan Lab Add Experiment、Money add-event / template picker、或其他 baseline 事件 create/edit flow；Plan Lab template 仍代表 sandbox what-if，Money flow 仍代表新增 / 編輯單一事件。
- onboarding beta entry 1 已上線：`/app/case/[caseId]/scenario/[scenarioId]/onboarding` 的 start / resume shell 現在會顯示最小版 preset suggestion 卡片，但只限 `meta.onboarded` 未完成的 active scenario；已完成 onboarding 的 scenario 仍會被 lifecycle route guard 導回 dashboard。
- 新 CTA 共用既有 onboarding draft write path：點擊 preset 只會建立 / 取代該 active scenario 的 scenario-scoped onboarding draft 起點，立即留在原 onboarding wizard 第一步繼續補完，不會寫 baseline event、也不會標記 onboarding complete。
- 已補最小 guardrail 測試與 source guard：確認 onboarding preset helper 只留在 onboarding surface，未被 Plan Lab Add Experiment、Money template picker、或通用 event template drawer 誤用。
- onboarding beta entry 1 文案現已與 member create dialog 對齊：preset 卡片改用同一個 audience / starting-context / ETA / outcome summary 結構，並把共享 presenter 抽到共用 view-model；對於 `dual-income-rental` / `new-baby-helper` 這兩個沒有 public journey 對應的 preset，則補上同語氣的 setup/recovery summary，避免 copy drift。
- 已補 replace / restart guardrail：只有在 active scenario 已存在 onboarding draft 時，才會顯示 replace warning 與較明確的 replace CTA；文案再次明示「只取代 onboarding 起點、不直接寫 baseline、也不代表 onboarding 已完成」。
- 本輪再把 shared summary model 的第二行語意正式收斂為 `starting context`，並同步調整 `en` / `zh-HK` onboarding preset copy，讓 onboarding start / resume shell 更明確表達這是重新選擇 onboarding draft 起點，而不是快速完成 scenario 或直接新增 baseline 資料。


## Latest Update (2026-03-18)
- Member create-case dialog journey summary now renders a fourth `outcome` line, so the handoff promise explicitly matches landing-page framing: first-session outcome + visible outputs rather than only audience / goal / ETA.
- Added locale coverage + render assertions for all allowlisted member journeys, ensuring every `journey.*.outcome` key exists in `en` / `zh-HK` and the dialog actually renders the promised conclusion line.
- Documented Phase B `Market Entry + Sample Journey` v1.1 planning scope, including message architecture, persona↔preset mapping, journey query contract, funnel tracking completion, and A/B copy experiment slots.
- Added an explicit progress table for market-entry work so product/UX can review `% / blockers / next milestone` without reading code-level notes.
- Promoted minimum KPI gates for first-run completion, journey-to-case conversion, onboarding start rate, and CTA CTR into the product status baseline, so market-entry readiness is measured against publishable thresholds rather than qualitative intent only.
- Marketing landing page IA refreshed to a text-led structure: hero proof cards, persona decision cards without decorative photos, sample journeys with explicit decision questions, and a clearer first-session CTA promise.
- Sample journey content kit now makes the decision question explicit for the three target personas (steady saver, dual-income home buyer, new parents), so marketing promise and in-product action path are easier to align.

## Latest Update (2026-03-20)
- Market-entry analytics contract is now locked to a metadata-only allowlist (`locale`, `journeyId`, `presetId`, `isSignedIn`, optional `experimentSlotKey`, optional `experimentVariant`) and tested, so PM/UX can review publishability without leaking case/scenario ids or financial payloads.
- `sample_journey_impression` now fires once per sample-journey card exposure path, preventing noisy re-render inflation while keeping journey-level cohort visibility.
- Sample journey CTA buttons now emit the same vendor-agnostic `journey_cta_click` event as persona cards, so public-entry click totals are comparable across entry modules.
- Member create-case success now emits `case_created` only after `createCaseAction` actually succeeds and right before the existing onboarding transition, preserving the `/member/cases` handoff contract and avoiding any onboarding-complete shortcut.
- Market-entry content assembly now defines three experiment slots — `landing.hero.value_prop`, `landing.persona.cta_summary`, `landing.sample_journey.summary` — with strict default fallback and stable variant naming (`control_v1`, `clarity_first_v1`, `decision_first_v1`). Slot switching is UI-only: it may change copy and ordering, but it may not alter `journey + preset` hrefs, signed-in/out auth return rules, invalid mapping fallback, or preset allowlists.
- Added `docs/product/MARKET_ENTRY_REVIEW_RITUAL.md` to define KPI formulas, weekly cadence, cohort cuts, minimum sample-size warnings, and the explicit `ready to scale traffic` publishability gate.

## Latest Update (2026-03-20)
- Market-entry public entry → member create contract is now productized behind one canonical source: allowlisted journey ids, primary preset mapping, and explicit blank-fallback policy all live together and are reused by member query parsing plus marketing CTA href construction.
- Query parsing is now strict: member `/member/cases` only reads `journey` and `preset`, unknown journey ids fall back safely, non-allowlisted presets fall back safely, and journey → preset mapping only happens through the canonical allowlist policy.
- Signed-out auth return now preserves the same create intent through auth without changing the mandatory landing rule: users still land on `/{locale}/member/cases`, and the create dialog rehydrates the same preset/journey intent after login.
- Product docs now include a concise persona coverage matrix and a durable blank-fallback rule so future market-entry work cannot silently bypass `/member/cases` or expose hidden seeds.

## Latest Update (2026-03-20)
- 本輪以 `ONBOARDING_GUARDRAIL_ANALYTICS_REVIEW_PACK.md` 的解讀 rubric + 現行 rules/severity policy 為基準，先整理出三類 weekly calibration 優先名單，方便 PM/UX 後續對真實 cohort 數據比對：
  - `top shown guardrails` 候選：`property_usage_missing`、`duplicate_current_home_housing_costs`、`duplicate_rent_expense_inputs`。這三條都屬於首次建模常見的 path-selection / duplicate-input 類訊號，最容易佔據 review 版面。
  - `lowest fix-success guardrails` 候選：`duplicate_current_home_housing_costs`、`duplicate_rent_expense_inputs`、`mortgage_property_basics_missing`。前兩條屬「看似錯、但未必真錯」的 current-home path ambiguity，後一條則常卡在使用者未意識到需要把按揭綁回物業基本資料。
  - `review-without-completion candidates` 候選：`duplicate_current_home_housing_costs`、`mortgage_core_fields_missing`、`property_usage_missing`。前者易造成「要返邊度修」猶豫，後兩者則直接影響 baseline 關鍵語意，若文案/target 不夠清楚就容易拖慢完成。
- calibration 結果：保留真正 baseline-distortion 的 blocking policy 不變（`mortgage_core_fields_missing`、`self_use_rental_conflict` 仍屬 `critical`）；`duplicate_current_home_housing_costs` 經本輪檢視後降為 `info`，因為它更接近「current home path 需重新確認」而非必然錯誤。其餘高摩擦規則則優先透過 copy / next-step clarity 調整，而非再增加規則數量。
- review / locale 文案本輪再聚焦三條高摩擦規則與一條低 fix-success 候選（`mortgage_property_basics_missing`）：統一改成「原因 + 影響 + 下一步」，並把 `warning` / `info` 區塊說明強化為「不阻止提交，只係幫你減少 baseline 誤讀」，減低責備感與誤判壓力。
- 仍未解決 blocker：目前尚未有真實 cohort 匯出結果可驗證上述候選排序，故這輪仍屬 rules+UX heuristic calibration；是否真的降低 review drop-off，仍要待下一個完整週窗的 review pack 驗證。
- 下一輪觀察重點：先看 `duplicate_current_home_housing_costs` 降為 `info` 後，是否只把 volume 由 `warning` 轉移到 `info`，定係真係改善 review→completed conversion；同時要留意 `property_usage_missing` 是否仍長期佔據 top shown 但 fix-success 未升，避免 member preset / persona mix 令訊號失真。

## Latest Update (2026-03-20)
- Highest-friction housing/property guardrails (`property usage`, `mortgage core`, `self-use vs rental`, `rental income missing`, `mortgage property basics`, duplicate housing-cost inputs) 已做 focused calibration pass：severity 邏輯維持「只把 baseline-distortion blocking 問題列為 critical」，避免把 review UI 再次變成過度示警。
- Review step 視覺層級再補強：critical / warning / info section 現在有更明顯的卡片底色、badge 與 CTA variant 差異，讓使用者更容易感知「必須先修正」vs「建議再看」vs「只是提醒」。
- 部分 guardrail target section 已改為更貼近實際修正位置（例如 `self_use_rental_conflict`、`mortgage_property_basics_missing` 導向 `Assets → Property details`；`duplicate_current_home_housing_costs` 導向 `Expenses → Housing costs`），降低 fix-loop 猶豫。
- i18n 測試已延伸到 targeted guardrail copy 的 placeholder parity 與 review severity sections bilingual coverage，避免文案微調後出現 en / zh-HK drift。

## Latest Update (2026-03-20)
- 新增 `apps/web/src/lib/analytics/onboardingReviewPack.ts`，可直接把 weekly window 內的 metadata-only onboarding funnel events 聚合成四個 operator/PM 可用 section：review→completed conversion、top shown guardrails、lowest fix-success guardrails、review-without-completion candidates。
- review pack formatter/export helper 已就緒，可把聚合結果轉成簡單 summary + table/JSON shape，方便後續接到內部週報、notebook 或手動匯出流程，而不引入新的 persistence。
- `onboardingFunnel` allowlist 現已由測試明確鎖定，並把 `reviewSourceContext` 收斂到文件化的 `initial_review / returned_from_fix`，確保 review pack builder 只消費已批准的 metadata-safe contract。
- Onboarding funnel contract 已升級為 weekly calibration 可用版本：`onboarding_review_viewed`、`guardrail_shown`、`guardrail_fixed`、`onboarding_completed` 全部維持 metadata-only，且 payload 會先經 allowlist sanitize，避免任何 `scenarioId`、金額或其他 business payload 混入。
- Review pass 現在會帶安全的 `reviewSessionId` 與 `reviewSourceContext`（initial review / returned from fix），讓 PM/UX 可以在不新增跨 scenario persistence 的前提下，拆出 review → completed conversion、top shown guardrails、low-fix-success guardrails 與 review 後未完成 guardrails。
- `guardrail_fixed` 語意已收斂為「使用者由 review 按 fix CTA 離開，並在下一個 review pass 該 rule 真正消失」才算 fixed；不再把單純導航或同一 review pass 內的暫時 state 波動視為修正成功。
- 已新增產品文件 `docs/product/ONBOARDING_GUARDRAIL_ANALYTICS_REVIEW_PACK.md`，定義每週必看 5 個數字、何時應降級/改 copy/暫停某條 rule，以及哪些訊號不應直接解讀成產品問題。

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
- Plan Lab deferred templates (`mortgage_rate_hike`, `move_home`) 現已補齊 roadmap / decision contract，並以 feature-flag + availability guard 收斂 launch policy：未達 onboarding beta 指標穩定前不出現在 user-facing picker。
- 若日後開啟 launch gate，`mortgage_rate_hike` 會只在有可編輯按揭事件時顯示並預填較高利率草稿；`move_home` 會只在有可編輯住屋事件時顯示並預填較後住屋時點草稿；兩者都沿用既有 Plan Lab UI/template mapping，不改 engine interface。
- Overview KPI metric detail modal 參考 Boldin 資訊層次，補齊評級說明內容，並調整為 Action Items + Rating Scale。
- 移除 Read More/Learn More 區塊（目前未有文章內容），避免顯示空資訊入口。
- `zh-HK` KPI detail 區塊標題與評級文案統一為中文，避免中英混雜。

- Architecture Delta Log
  - Date: 2026-03-21
  - Changed modules: `docs/product/ROADMAP.md`, `docs/product/IMPLEMENTATION_STATUS.md`, `docs/product/DECISIONS.md`, `AGENTS.md`
  - Data-flow impact: no runtime data-flow change; this pass only documents the app-internal preset extension IA contract and clarifies that future preset suggestions must stay active-scenario-scoped onboarding-draft actions.
  - Backward compatibility: member `/member/cases` remains the only productized preset entry and the only post-auth landing path; no engine, compiler, routing, persistence, or analytics payload contract changed.
  - Risk & rollback: documentation-only, low risk; rollback by reverting these docs if product direction changes before beta implementation starts.
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
  - Date: 2026-03-20
  - Changed modules: `apps/web/features/planLab/decisionTemplates.ts`, `apps/web/features/planLab/PlanLabPanel.tsx`, `apps/web/src/domain/planLab/types.ts`, `apps/web/src/lib/featureFlags.ts`, `apps/web/messages/en.json`, `apps/web/messages/zh-HK.json`, Plan Lab tests, `docs/product/ROADMAP.md`, `docs/product/IMPLEMENTATION_STATUS.md`, `docs/product/DECISIONS.md`
  - Data-flow impact: only Plan Lab decision-template catalog / gating / UI mapping changed; deferred templates continue to read active-scenario baseline events only and stay behind a launch flag until beta metrics stabilize.
  - Backward compatibility: existing templates, patch flow, experiment groups, and engine interfaces remain unchanged; when the flag is off, no new user-facing template appears.
  - Risk & rollback: low risk while gated off; rollback by removing the new catalog entries / handlers or leaving `NEXT_PUBLIC_FF_PLANLAB_DEFERRED_DECISION_TEMPLATES` disabled.

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
- Scenario presets/seeds 已接入 member 建案例入口作為 onboarding-prefill v1；app 內延伸入口現已完成產品 IA 定義，但仍屬 beta contract，尚未正式產品化上線。
- Plan Lab 已有實驗與比較骨架，但常見決策模板與結論導向輸出仍需產品化。
- Cloud save/revision conflict 已可運作，仍需把「首次建模 -> 長期回訪」路徑整合成更低摩擦流程。

## 真正阻塞上市
- Onboarding 與 property bundle 的體驗仍未形成一致、低摩擦的首次建模流程。
- Guardrails 雖已有 completeness / review workflow / decision memo，但按 PR1 固定 artifacts 對照的兩個完整週窗（2026-03-02 → 2026-03-09、2026-03-09 → 2026-03-16 UTC）都仍無實際 review sessions，因此未能以真實 evidence 判斷四條 priority rules 的 show-rate、fix-success、review→completed conversion 是否改善、持平穩定或惡化，影響用戶信任與 roadmap 排序信心。
- 可行動結論頁不足，使用者較難快速理解決策差異與下一步。
- 市場入口與示例旅程雖已有固定 weekly board，但 current / previous 兩個固定週窗都仍無真實 market-entry cohort export，故 publishability / confusion / scale-traffic 判斷仍停留在 `hold` / observation only；這些結論現時仍屬 heuristic，而非由真實 cohort 支撐。

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
  - 最小 payload：`locale`, `journeyId`, `presetId`, `isSignedIn`；如需切 experiment cohort，可額外帶 allowlisted metadata `experimentSlotKey`, `experimentVariant`。
- `sample_journey_impression`
  - 定義：sample journey section 內每張卡片首次進入目前 render exposure path 時記錄一次曝光；同一掛載內 re-render 不重複送出。
  - 最小 payload：`locale`, `journeyId`, `presetId`, `isSignedIn`；如需切 experiment cohort，可額外帶 allowlisted metadata `experimentSlotKey`, `experimentVariant`。
- `journey_cta_click`
  - 定義：點擊 persona banner 或 sample journey CTA（含 journey + preset deep-link 意圖）。
  - 最小 payload：`locale`, `journeyId`, `presetId`, `isSignedIn`；如需切 experiment cohort，可額外帶 allowlisted metadata `experimentSlotKey`, `experimentVariant`。
- `auth_modal_open`
  - 定義：由 marketing CTA 開啟登入/註冊 modal。
  - 最小 payload：`locale`, `journeyId`, `presetId`, `isSignedIn`；如需切 experiment cohort，可額外帶 allowlisted metadata `experimentSlotKey`, `experimentVariant`。
- `case_created`
  - 定義：member/cases create-case server action 真正成功後、流程轉入下一步前記錄一次成功建立案例。
  - 最小 payload：`locale`, `journeyId`, `presetId`, `isSignedIn`；如需切 experiment cohort，可額外帶 allowlisted metadata `experimentSlotKey`, `experimentVariant`。
- `preset_create_started`
  - 定義：member/cases create dialog 進入 preset flow（含 journey entry intent 或手動選 preset）。
  - 最小 payload：`locale`, `journeyId`, `presetId`, `isSignedIn`；如需切 experiment cohort，可額外帶 allowlisted metadata `experimentSlotKey`, `experimentVariant`。
- `preset_create_submitted`
  - 定義：create-case 送出且採用 preset。
  - 最小 payload：`locale`, `journeyId`, `presetId`, `isSignedIn`；如需切 experiment cohort，可額外帶 allowlisted metadata `experimentSlotKey`, `experimentVariant`。
- `onboarding_started`
  - 定義：preset 建立後導向 onboarding 前記錄起點。
  - 最小 payload：`locale`, `journeyId`, `presetId`, `isSignedIn`；如需切 experiment cohort，可額外帶 allowlisted metadata `experimentSlotKey`, `experimentVariant`。

### 目前可量測漏斗定義
1. `market_landing_view`
2. `sample_journey_impression`
3. `journey_cta_click`
4. `auth_modal_open`（僅未登入分支）
5. `preset_create_started`
6. `case_created`
7. `preset_create_submitted`
8. `onboarding_started`

### 指標口徑（v1）
- Landing → Journey CTA CTR = `journey_cta_click` / `market_landing_view`
- Sample journey card CTR = `journey_cta_click` / `sample_journey_impression`
- Journey CTA → Preset Start = `preset_create_started` / `journey_cta_click`
- Preset Start → Case Created CVR = `case_created` / `preset_create_started`
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
1. 先把下一個完整 Monday → Monday UTC 週窗的真實 onboarding / market-entry export 接入固定 decision memo，讓四條 priority guardrails 與三個 preset recovery 入口首次取得可比較的 cohort 證據；在此之前，所有 show-rate / fix-success / review→completed / confusion 結論都仍只屬 heuristic。
2. 以「可完成一次重大家庭決策」為目標，繼續收斂 Onboarding + Property Bundle 旅程，但只可把已由真實 cohort 支撐的 friction 點升級為產品優先級。
3. 讓 Plan Lab 以模板化決策入口驅動，並補齊比較摘要的可行動建議；deferred 模板 rollout 仍必須等到兩個完整週窗達到支持門檻後才可排序前移。
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
