# North Star Product Decisions

Last updated: 2026-03-07

## Decision Log

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
