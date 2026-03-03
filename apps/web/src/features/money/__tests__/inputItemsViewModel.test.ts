import { describe, expect, it } from "vitest";
import type { ScenarioAsset } from "../../../store/scenarioStore";
import type { ScenarioEvent } from "../../../domain/scenarioV2/events";
import {
  buildInputAssetMetaTags,
  buildInputEventDescription,
  buildInputEventMetaTags,
  buildInputRuleTags,
} from "../inputItemsViewModel";

const t = (key: string, values?: Record<string, string | number>) => {
  if (!values) {
    return key;
  }
  return `${key}:${JSON.stringify(values)}`;
};

describe("inputItemsViewModel", () => {
  it("builds minimal rule tags", () => {
    const tags = buildInputRuleTags("rule-1", t);
    expect(tags.map((tag) => tag.kind)).toEqual(["expenseType", "attribute"]);
    expect(tags.map((tag) => tag.label)).toEqual(["inputsRuleTagType", "inputsRuleTagLifecycle"]);
  });

  it("builds asset tags from money meta view model", () => {
    const asset: ScenarioAsset = {
      id: "asset-1",
      kind: "investment",
      currentValue: 1000,
      ownerMemberId: "m1",
      source: "manual",
    };
    const tags = buildInputAssetMetaTags(asset, {
      t,
      memberLookupRecord: { m1: "Alice" },
    });

    expect(tags.some((tag) => tag.kind === "assetType")).toBe(true);
    expect(tags.some((tag) => tag.kind === "member" && tag.label === "Alice")).toBe(true);
  });

  it("builds event tags with adjustment badge", () => {
    const event: ScenarioEvent = {
      id: "event-1",
      type: "cashflow",
      kind: "expense",
      cadence: "monthly",
      amount: 200,
      startMonth: "2024-01",
      memberId: "m2",
      label: "Rent",
    };

    const tags = buildInputEventMetaTags(event, {
      t,
      memberLookupRecord: { m2: "Bob" },
      adjustmentCount: 2,
    });

    expect(tags.some((tag) => tag.kind === "expenseType")).toBe(true);
    expect(tags.some((tag) => tag.kind === "adjustment")).toBe(true);
  });

  it("uses i18n key for event description with adjustments", () => {
    const summary = buildInputEventDescription(t, {
      month: "2024-01",
      amount: "HK$200",
      adjustmentCount: 1,
      latestAdjustmentMonth: "2024-06",
      latestAdjustmentAmount: "HK$220",
      startMonth: "2024-01",
      endMonth: "ongoing",
    });

    expect(summary.startsWith("inputsEventMetaWithAdjustments")).toBe(true);
  });
});
