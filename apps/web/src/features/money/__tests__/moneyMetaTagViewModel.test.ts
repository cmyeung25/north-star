import { describe, expect, it } from "vitest";
import type { ScenarioEvent } from "../../../domain/scenarioV2/events";
import type { ScenarioAsset, ScenarioLiability } from "../../../store/scenarioStore";
import { buildMoneyMetaTagViewModel } from "../moneyMetaTagViewModel";

const buildOptions = () => ({
  householdLabel: "Household",
  memberLookupRecord: { m1: "Alex" },
  resolveTypeLabel: (meta: { type: string; kind: string }) => `${meta.type}:${meta.kind}`,
  resolveFrequencyLabel: (meta: { frequency: string }) =>
    meta.frequency === "none" ? null : `freq:${meta.frequency}`,
  resolveLifecycleLabel: (meta: { lifecycle: string }) => `life:${meta.lifecycle}`,
});

describe("moneyMetaTagViewModel", () => {
  it("builds tags for cashflow income with member ownership", () => {
    const event: ScenarioEvent = {
      id: "e-income",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 20000,
      memberId: "m1",
    };

    const result = buildMoneyMetaTagViewModel(event, {
      ...buildOptions(),
      ownerId: event.memberId,
    });

    expect(result.metaTags[0]).toMatchObject({
      domain: "income",
      type: "cashflow",
      kind: "income",
      belongsTo: "member",
      frequency: "monthly",
      lifecycle: "ongoing",
    });
    expect(result.tags.map((tag) => tag.kind)).toEqual(["eventType", "attribute", "cadence", "member"]);
  });

  it("builds expense tags for housing/loan/insurance", () => {
    const housing: ScenarioEvent = {
      id: "h1",
      type: "housing",
      kind: "rent",
      startMonth: "2026-01",
      rentMonthly: 10000,
    };
    const loan: ScenarioEvent = {
      id: "l1",
      type: "loan",
      loanKind: "personal",
      startMonth: "2026-01",
      principal: 100000,
      annualInterestRatePct: 4,
      termYears: 5,
      liabilityId: "l1",
    };
    const insurance: ScenarioEvent = {
      id: "i1",
      type: "insurance",
      mode: "quick",
      startMonth: "2026-01",
      premiumMonthly: 500,
    };

    const result = [housing, loan, insurance].map((item) =>
      buildMoneyMetaTagViewModel(item, buildOptions()).metaTags[0]
    );

    expect(result.every((meta) => meta.domain === "expense")).toBe(true);
    expect(result.map((meta) => meta.type)).toEqual(["housing", "loan", "insurance"]);
  });

  it("builds asset tags", () => {
    const asset: ScenarioAsset = {
      id: "a1",
      kind: "investment",
      ownerMemberId: "m1",
      currentValue: 123,
    };

    const result = buildMoneyMetaTagViewModel(asset, {
      ...buildOptions(),
      ownerId: asset.ownerMemberId,
    });

    expect(result.metaTags[0]).toMatchObject({
      domain: "asset",
      type: "investment",
      kind: "investment",
      belongsTo: "member",
      frequency: "none",
    });
    expect(result.tags[0]?.kind).toBe("assetType");
  });

  it("builds liability tags", () => {
    const liability: ScenarioLiability = {
      id: "d1",
      kind: "mortgage",
      principalOutstanding: 100,
    };

    const result = buildMoneyMetaTagViewModel(liability, buildOptions());

    expect(result.metaTags[0]).toMatchObject({
      domain: "liability",
      type: "mortgage",
      kind: "mortgage",
      belongsTo: "household",
      frequency: "none",
    });
    expect(result.tags[0]?.kind).toBe("liabilityType");
  });
});
