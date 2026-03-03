import { describe, expect, it } from "vitest";
import { adaptPlanLabRowMeta } from "../planLabMetaTagAdapter";

const frequencyLabels = {
  monthly: "每月",
  quarterly: "每季",
  yearly: "每年",
  oneOff: "一次性",
  everyNMonths: "每 N 個月",
  schedule: "排程",
} as const;

describe("adaptPlanLabRowMeta", () => {
  it("returns consistent metadata fields for baseline and experiment rows", () => {
    const baseline = adaptPlanLabRowMeta({
      row: {
        id: "event:salary",
        kind: "event",
        title: "Salary",
        category: "income",
        memberId: "m1",
        startMonth: "2026-01",
        amount: 50000,
        frequency: "monthly",
        linkState: "linked",
      },
      currency: "HKD",
      locale: "zh-HK",
      frequencyLabels,
      householdLabel: "家庭",
      memberLookupRecord: { m1: "Alex" },
    });

    const experiment = adaptPlanLabRowMeta({
      row: {
        id: "event:salary-exp",
        kind: "event",
        title: "Salary",
        category: "income",
        memberId: "m1",
        startMonth: "2026-01",
        amount: 50000,
        frequency: "monthly",
        linkState: "orphaned",
      },
      currency: "HKD",
      locale: "zh-HK",
      frequencyLabels,
      householdLabel: "家庭",
      memberLookupRecord: { m1: "Alex" },
    });

    expect(baseline.metaTags[0]).toMatchObject({
      domain: "income",
      belongsTo: "member",
      frequency: "monthly",
    });
    expect(experiment.metaTags[0]).toMatchObject({
      domain: "income",
      belongsTo: "member",
      frequency: "monthly",
    });
    expect(baseline.linkState).toBe("linked");
    expect(experiment.linkState).toBe("orphaned");
  });

  it("prefers scenario-level member over library default member", () => {
    const adapted = adaptPlanLabRowMeta({
      row: {
        id: "event:rent",
        kind: "event",
        title: "Rent",
        category: "expense",
        memberId: "scenario-member",
        defaultMemberId: "library-member",
        startMonth: "2026-01",
        amount: 18000,
        frequency: "monthly",
      },
      currency: "HKD",
      locale: "zh-HK",
      frequencyLabels,
      householdLabel: "家庭",
      memberLookupRecord: {
        "scenario-member": "Scenario Owner",
        "library-member": "Library Default",
      },
    });

    const belongsToTag = adapted.tags.find((tag) => tag.kind === "member");
    expect(belongsToTag?.label).toBe("Scenario Owner");
  });
});
