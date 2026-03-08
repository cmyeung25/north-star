# North Star Implementation Status
Last updated: 2026-03-08

## Readiness Baseline
| 指標 | 分數 | 說明 |
|---|---:|---|
| Core infra readiness | 70% | auth/cloud save、scenario persistence、核心路由與 quality gates 已可運行 |
| Closed Beta readiness | 58% | 核心能力存在，Plan Lab 模板入口與摘要層已前進主流程，但 onboarding/guardrails 仍待整合 |
| Public MVP readiness | 38% | 可行動摘要層已有最小可用品質，但 market entry 與營運支援仍有明顯缺口 |

## Capability Matrix
| 能力模組 | 進度 | 現況 | 上市缺口 |
|---|---:|---|---|
| Onboarding + Property Bundle | 65% | 已有家庭/收入/支出/物業/按揭欄位與流程骨架 | 需補齊既有物業 household 的一致輸入與審核體驗 |
| Plan Lab 決策化 | 72% | 已接入 3 類決策模板（置業/生育/收入衝擊）與模板可用性 guard；實驗群組與保存流程維持一致 | 尚缺利率上升/換樓等後續模板與模板成效校準 |
| Persistence / Auth | 81% | case/scenario, cloud save, revision conflict, and dev-only E2E auth bootstrap/reset are in place | Still needs tighter onboarding/preset/compare integration and CI coverage |
| Guardrails / Completeness | 40% | 已有部分 warning 與檢查邏輯 | 需產品化 completeness score、關鍵警示與修正引導 |
| Actionable Output | 52% | 已加入 Plan Lab 決策摘要（風險節奏/方向、正負 driver、下一步建議） | 仍需擴展到跨頁輸出與可下載/可分享格式 |
| Preset ???? | 58% | member ??? modal ??? blank/preset create mode?preset ? onboarding-prefill ???? 6 ???? seeds?seed ?? i18n ??????? raw keys | app ????????????? beta ???????? |
| GTM / 營運就緒 | 20% | 有 marketing pages 基礎 | 缺 sample journey 導流、beta feedback loop、支援流程 |


## Latest Update (2026-03-08)
- Fixed onboarding v3 income/expense event category mapping so auto-salary and onboarding-created cashflows persist with correct `category`/`expenseCategory` values when entering Money page (instead of falling back to non-salary/other buckets).
- Audited `apps/web/messages/zh-HK.json` for encoding and placeholder drift; restored `scenarios.seeds.*` Traditional Chinese copy and kept shared placeholders aligned with `en.json`.
- Added a locale guardrail test to scan zh-HK messages for mojibake markers and placeholder-token mismatches on shared keys.
- Fixed literal `????` placeholders in zh-HK preset seed copy so member create-case cards render real Traditional Chinese content.
- Fixed member create-case preset seed-card i18n wiring and restored zh-HK `seeds` copy so preset cards no longer render raw `seeds.*` keys or duplicated property/mortgage labels.
- Completed member create-case preset v1: fixed `member.caseDialogs` create-mode/preset i18n so the modal no longer leaks raw message keys.
- Expanded member preset allowlist to six productized seeds, including `new-baby` and `new-baby-helper`.
- Locked member `create mode preset` to onboarding-prefill: create case/scenario first, store a scenario-scoped onboarding draft, then enter onboarding rather than jumping directly into an onboarded app scenario.

- Plan Lab「新增實驗」入口新增決策模板模式，v1 提供 `home_purchase`、`new_baby`、`income_shock`。
- 置業/生育模板沿用既有 life-event bundle wizard，預設打包為 experiment group。
- 收入衝擊模板沿用 baseline override 流程，預設 `-20%`、`12 個月`、`baseMonth+1`，若無可用收入事件則禁用並顯示原因。
- 決策摘要層新增 risk timing / risk trend / top drivers / recommended actions（heuristic，無 engine 變更）。
- Fixed zh-HK Plan Lab decision-summary/template placeholder strings (`????`) to real i18n copy.
- Localized Plan Lab decision template/summary keys in `zh-HK.json` to Traditional Chinese copy (replacing temporary English fallback).
- Added dev-only Supabase E2E auth bootstrap/reset endpoints plus Playwright authenticated storage-state setup for local product validation without weakening normal auth redirects.
- Fixed onboarding seed prefill regex parsing so preset-based onboarding can import `seedPrefill.ts` and keep rent/mortgage classification stable for preset hydration.
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

## Next Recommended Priority
1. 以「可完成一次重大家庭決策」為目標，收斂 Onboarding + Property Bundle 旅程。
2. 讓 Plan Lab 以模板化決策入口驅動，並補齊比較摘要的可行動建議。
3. 將 member preset onboarding-prefill 延伸到 app 內延伸入口，並建立封閉 beta 回饋閉環與量化追蹤。
