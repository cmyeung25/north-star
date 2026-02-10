import { describe, expect, it } from "vitest";
import type { ScenarioEvent } from "../../../src/domain/scenarioV2/events";
import { formatExperimentChanges, formatExperimentSummary } from "../experimentSummary";

describe("experimentSummary", () => {
  it("formats stable readable change summary", () => {
    const event = {
      id: "salary-1",
      type: "cashflow",
      kind: "income",
      label: "固定薪金",
      amount: 30000,
      startMonth: "2025-01",
    } as ScenarioEvent;

    const changes = formatExperimentChanges(
      event,
      {
        id: "exp-1",
        title: "事件實驗",
        type: "event_override",
        targetEventId: "salary-1",
        changes: {
          amountMultiplier: 1.1,
          startMonthShift: 3,
          endMonthShift: -6,
          growthMode: "assumption",
        },
      },
      "HKD",
      "zh-HK"
    );

    expect(changes).toEqual([
      "金額 +10%",
      "開始月份延後 3 個月",
      "結束月份提前 6 個月",
      "成長：跟隨假設",
    ]);
    expect(formatExperimentSummary(changes)).toBe("金額 +10%；開始月份延後 3 個月");
  });
});
