import { describe, expect, it } from "vitest";
import { parsePlanLabRouteEntry } from "../routeEntry";

describe("parsePlanLabRouteEntry", () => {
  it("opens decision templates when explicit flag is provided", () => {
    expect(
      parsePlanLabRouteEntry({
        openDecisionTemplates: "1",
        decisionTemplate: null,
      })
    ).toEqual({
      openDecisionTemplates: true,
      decisionTemplateId: null,
    });
  });

  it("accepts allowlisted decision template ids", () => {
    expect(
      parsePlanLabRouteEntry({
        openDecisionTemplates: null,
        decisionTemplate: "home_purchase",
      })
    ).toEqual({
      openDecisionTemplates: true,
      decisionTemplateId: "home_purchase",
    });
  });

  it("fails closed on unknown decision template ids", () => {
    expect(
      parsePlanLabRouteEntry({
        openDecisionTemplates: null,
        decisionTemplate: "hidden_template",
      })
    ).toEqual({
      openDecisionTemplates: false,
      decisionTemplateId: null,
    });
  });
});
