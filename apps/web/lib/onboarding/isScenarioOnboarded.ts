export type ScenarioOnboardingShape = {
  meta?: {
    onboarded?: unknown;
    onboardedAt?: unknown;
  };
  clientComputed?: {
    onboardingCompleted?: unknown;
  };
};

export const isScenarioOnboarded = (scenario: ScenarioOnboardingShape | null | undefined): boolean => {
  if (!scenario) {
    return false;
  }

  return (
    scenario.meta?.onboarded === true ||
    scenario.clientComputed?.onboardingCompleted === true ||
    Boolean(scenario.meta?.onboardedAt)
  );
};
