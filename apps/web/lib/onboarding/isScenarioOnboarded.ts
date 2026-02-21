import { resolveScenarioLifecycle } from "../../src/domain/scenarioStateModel";

export type ScenarioOnboardingShape = {
  meta?: {
    onboarded?: unknown;
    onboardedAt?: unknown;
    skipOnboarding?: unknown;
    isSeeded?: unknown;
  };
  clientComputed?: {
    onboardingCompleted?: unknown;
  };
};

export const isScenarioOnboarded = (scenario: ScenarioOnboardingShape | null | undefined): boolean =>
  resolveScenarioLifecycle(scenario) === "active";
