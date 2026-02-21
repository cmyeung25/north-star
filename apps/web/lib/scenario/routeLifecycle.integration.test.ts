import { describe, expect, it } from "vitest";
import {
  scenarioDashboardPath,
  scenarioMoneyPath,
  scenarioOnboardingPath,
  scenarioPlanLabPath,
} from "../routes/appRoutes";
import { resolveScenarioLifecycleFromPayload } from "./isScenarioOnboarded";

const resolveScenarioRoute = (
  payload: Record<string, unknown>,
  caseId: string,
  scenarioId: string,
  destination: "dashboard" | "money" | "planlab",
) => {
  if (resolveScenarioLifecycleFromPayload(payload, scenarioId) !== "active") {
    return scenarioOnboardingPath(caseId, scenarioId);
  }

  if (destination === "dashboard") {
    return scenarioDashboardPath(caseId, scenarioId);
  }

  if (destination === "money") {
    return scenarioMoneyPath(caseId, scenarioId);
  }

  return scenarioPlanLabPath(caseId, scenarioId);
};

describe("scenario route integration", () => {
  const caseId = "case-1";
  const scenarioId = "scenario-1";

  it("redirects incomplete onboarding to onboarding route", () => {
    const route = resolveScenarioRoute(
      {
        activeScenarioId: scenarioId,
        scenarios: [{ id: scenarioId, meta: { onboarded: false } }],
      },
      caseId,
      scenarioId,
      "dashboard",
    );

    expect(route).toBe(scenarioOnboardingPath(caseId, scenarioId));
  });

  it("allows active scenario into dashboard/money/planlab routes", () => {
    const payload = {
      activeScenarioId: scenarioId,
      scenarios: [{ id: scenarioId, meta: { onboarded: true } }],
    };

    expect(resolveScenarioRoute(payload, caseId, scenarioId, "dashboard")).toBe(
      scenarioDashboardPath(caseId, scenarioId),
    );
    expect(resolveScenarioRoute(payload, caseId, scenarioId, "money")).toBe(scenarioMoneyPath(caseId, scenarioId));
    expect(resolveScenarioRoute(payload, caseId, scenarioId, "planlab")).toBe(
      scenarioPlanLabPath(caseId, scenarioId),
    );
  });
});
