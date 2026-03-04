# Onboarding V3 Event Mapping

## 參考來源

- `packages/engine/src/eventCatalog.ts`
- `apps/web/src/events/eventCatalog.ts`
- `apps/web/src/features/timeline/schema.ts`

## 背景

Onboarding v3 目前收集的是 `scenarioV2` 的 `cashflow` 事件（`kind: income | expense`）。
真正引擎/時間軸層使用的是 `EventType`（例如 `salary`, `travel`, `custom`）與可選 `incomeSubtype`。
因此在提交流程加入 mapper，把 onboarding UI 的類型與分段標籤映射為標準語意欄位。

## 映射規則（目前暫用）

> 實作位置：`apps/web/src/features/onboarding/v3/eventTypeMapper.ts`

| Onboarding UI 類型 | 判斷來源 | 映射 EventType | 補充語意 |
|---|---|---|---|
| 日常費 | `onboarding:v3:expense:daily-monthly` | `custom` | 無 |
| 旅遊費 | `onboarding:v3:expense:travel` | `travel` | 無 |
| 稅金支出 | `onboarding:v3:expense:tax` | `custom` | `tags += ["tax"]` |
| 薪資 | `onboarding:v3:income:salary` | `salary` | `incomeSubtype = "salary"` |
| 房租收入 | `onboarding:v3:income:rent` | `custom` | `incomeSubtype = "rental"`, `tags += ["income:rental"]` |

## 暫用 mapping 清單

以下屬於目前可直接落地（不改 engine catalog）的做法：

1. 日常費 → `custom`。
2. 稅金支出 → `custom` + `tax` tag。
3. 房租收入 → `custom` + `incomeSubtype: rental` + `income:rental` tag。

## 需擴充 engine eventCatalog 才能完整語意化

若要讓語意在 engine 層也成為一等公民，需在 `packages/engine/src/eventCatalog.ts` 與 web 對應 catalog 擴充：

1. `tax`（expense）事件型別：避免以 `custom + tag` 表示。
2. `rental_income`（income）事件型別：避免以 `custom + incomeSubtype/tag` 表示。
3. （可選）`daily_living`（expense）事件型別：讓「日常費」不再落到 `custom`。

## 實作備註

- mapper 目前把標準語意放在 `event.meta.timelineEventType` / `event.meta.timelineIncomeSubtype`，並保留原始 `cashflow` 事件，避免影響現有 projection 流程。
- mapper 會在映射後移除 `onboarding:v3:*` 內部標籤，避免 Plan Lab/Baseline 卡片直接顯示 onboarding 內部 category code（例如 `onboarding:v3:expense:daily-monthly`）；保留語意標籤（如 `tax`、`income:rental`）供後續分類使用。
- 之後若 engine/compiler 支援直接接受這些語意，可再把欄位提升到正式 adapter/compiler 流程。
