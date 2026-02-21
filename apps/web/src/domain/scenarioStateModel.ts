export type ScenarioLifecycle = "draft" | "active";

export type WorkspaceMode = "core" | "plan_lab";

type ScenarioLifecycleInput = {
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
