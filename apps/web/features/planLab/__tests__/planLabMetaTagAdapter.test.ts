import { describe, expect, it } from "vitest";
import { adaptPlanLabRowMeta, type PlanLabMetaTagAdapterInput } from "../planLabMetaTagAdapter";

const baseRow: PlanLabMetaTagAdapterInput = {
  id: "row-1",
  kind: "event",
  category: "income",
  title: "Salary",
  amount: 32000,
  frequency: "monthly",
  startMonth: "2026-01",
};

const buildMeta = (row: PlanLabMetaTagAdapterInput, memberLookupRecord: Record<string, string>) =>
  adaptPlanLabRowMeta({
    row,
    currency: "HKD",
    locale: "zh-HK",
    frequencyLabels: {
      monthly: "每月",
      quarterly: "每季",
      yearly: "每年",
      oneOff: "一次性",
      everyNMonths: "每 N 個月",
      schedule: "排程",
    },
    lifecycleLabels: {
      oneOff: "一次性",
      hasEndMonth: "有結束月份",
      ongoing: "持續",
    },
    householdLabel: "家庭",
    orphanedLabel: "孤兒項目",
    memberLookupRecord,
  });

describe("adaptPlanLabRowMeta", () => {
  it("shows belongsTo member tag when members exist", () => {
    const result = buildMeta({ ...baseRow, memberId: "member-1" }, { "member-1": "Alex" });

    expect(result.tags.some((tag) => tag.kind === "member" && tag.label === "Alex")).toBe(true);
  });

  it("falls back to household tag when members are missing", () => {
    const result = buildMeta({ ...baseRow, memberId: "member-x" }, {});

    expect(result.tags.some((tag) => tag.kind === "member" && tag.label === "家庭")).toBe(true);
  });

  it("shows orphaned linkState tag when row linkState is orphaned", () => {
    const result = buildMeta({ ...baseRow, linkState: "orphaned" }, {});

    expect(result.linkState).toBe("orphaned");
    expect(result.tags.some((tag) => tag.kind === "source" && tag.label === "孤兒項目")).toBe(true);
  });
});
