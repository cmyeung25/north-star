import { describe, expect, it } from "vitest";
import {
  scenarioDashboardPath,
  scenarioMoneyPath,
  scenarioOnboardingPath,
  scenarioPlanLabPath,
} from "../routes/appRoutes";
import { resolveScenarioLifecyclePath } from "./lifecycle";
import { resolveScenarioLifecycleFromPayload } from "./isScenarioOnboarded";

const resolveScenarioRoute = (
  payload: Record<string, unknown>,
  caseId: string,
  scenarioId: string,
  destination: "dashboard" | "money" | "planlab",
) => {
  const lifecycle = resolveScenarioLifecycleFromPayload(payload, scenarioId);
  return resolveScenarioLifecyclePath(caseId, scenarioId, lifecycle, destination);
};

describe("scenario route integration", () => {
  const caseId = "case-1";
  const scenarioId = "scenario-1";

  it("draft can only route to onboarding", () => {
    const payload = {
      activeScenarioId: scenarioId,
      scenarios: [{ id: scenarioId, meta: { onboarded: false } }],
    };

    expect(resolveScenarioRoute(payload, caseId, scenarioId, "dashboard")).toBe(scenarioOnboardingPath(caseId, scenarioId));
    expect(resolveScenarioRoute(payload, caseId, scenarioId, "money")).toBe(scenarioOnboardingPath(caseId, scenarioId));
    expect(resolveScenarioRoute(payload, caseId, scenarioId, "planlab")).toBe(scenarioOnboardingPath(caseId, scenarioId));
  });

  it("active can route to dashboard/money/planlab", () => {
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
