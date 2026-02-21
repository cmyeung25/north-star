import {
  scenarioDashboardPath,
  scenarioMoneyPath,
  scenarioOnboardingPath,
  scenarioPlanLabPath,
} from "../routes/appRoutes";

export type ScenarioLifecycle = "draft" | "active";

export type WorkspaceMode = "core" | "plan_lab";

export type ScenarioLifecycleInput = {
  meta?: {
    onboarded?: unknown;
    onboardedAt?: unknown;
    skipOnboarding?: unknown;
    isSeeded?: unknown;
  };
  clientComputed?: {
    onboardingCompleted?: unknown;
  };
} | null | undefined;

export const resolveScenarioLifecycle = (scenario: ScenarioLifecycleInput): ScenarioLifecycle => {
  if (!scenario) {
    return "draft";
  }

  if (
    scenario.meta?.onboarded === true ||
    scenario.clientComputed?.onboardingCompleted === true ||
    Boolean(scenario.meta?.onboardedAt) ||
    scenario.meta?.skipOnboarding === true ||
    scenario.meta?.isSeeded === true
  ) {
    return "active";
  }

  return "draft";
};

export const resolveWorkspaceMode = (pathname: string | null | undefined): WorkspaceMode => {
  if (!pathname) {
    return "core";
  }

  return pathname.includes("/planlab") || pathname.includes("/plan-lab") ? "plan_lab" : "core";
};

export type GatedDestination = "dashboard" | "money" | "planlab";

export const resolveScenarioLifecyclePath = (
  caseId: string,
  scenarioId: string,
  lifecycle: ScenarioLifecycle,
  destination: GatedDestination,
) => {
  if (lifecycle !== "active") {
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
