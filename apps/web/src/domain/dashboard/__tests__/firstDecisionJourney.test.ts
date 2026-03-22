import { describe, expect, it } from "vitest";
import { recommendOverviewFirstDecisionJourney } from "../firstDecisionJourney";

describe("recommendOverviewFirstDecisionJourney", () => {
  it("prioritizes retirement when retirement focus is selected", () => {
    expect(
      recommendOverviewFirstDecisionJourney({
        meta: { personaFocuses: ["retirement"] },
        events: [],
        positions: {},
      })
    ).toEqual({
      templateId: "retirement",
      signal: "retirement",
    });
  });

  it("maps education focus to parenting comparison", () => {
    expect(
      recommendOverviewFirstDecisionJourney({
        meta: { personaFocuses: ["education"] },
        events: [],
        positions: {},
      })
    ).toEqual({
      templateId: "parenting",
      signal: "parenting",
    });
  });

  it("maps family/fertility focus to childbirth comparison", () => {
    expect(
      recommendOverviewFirstDecisionJourney({
        meta: { personaFocuses: ["family"] },
        events: [],
        positions: {},
      })
    ).toEqual({
      templateId: "childbirth",
      signal: "childbirth",
    });
  });

  it("recommends buy-home comparison for renters", () => {
    expect(
      recommendOverviewFirstDecisionJourney({
        meta: {},
        events: [{ type: "housing", kind: "rent" }],
        positions: {},
      } as never)
    ).toEqual({
      templateId: "home_purchase",
      signal: "rent_to_buy",
    });
  });

  it("recommends income resilience for owners with mortgage exposure", () => {
    expect(
      recommendOverviewFirstDecisionJourney({
        meta: {},
        events: [{ type: "housing", kind: "mortgage" }],
        positions: { homes: [{}] },
      } as never)
    ).toEqual({
      templateId: "income_shock",
      signal: "income_resilience",
    });
  });

  it("falls back to rental setup when no stronger signal exists", () => {
    expect(
      recommendOverviewFirstDecisionJourney({
        meta: {},
        events: [],
        positions: { homes: [{}] },
      } as never)
    ).toEqual({
      templateId: "rental_plan",
      signal: "rental_setup",
    });
  });
});
