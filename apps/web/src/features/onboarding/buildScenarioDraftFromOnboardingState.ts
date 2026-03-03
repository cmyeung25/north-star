import type { SubmitScenarioDraftInput } from "../../domain/scenarioDraft/submitScenarioDraft";
import { deriveScenarioLifecycleState } from "../../domain/scenarioDraft/lifecycle";
import type { Scenario } from "../../store/scenarioStore";

export const buildScenarioDraftFromOnboardingState = ({
  scenarioPreview,
  baseMonth,
  nowIso,
}: {
  scenarioPreview: Scenario;
  baseMonth: string;
  nowIso: string;
}): SubmitScenarioDraftInput["draft"] => {
  const lifecycle = deriveScenarioLifecycleState({ source: "onboarding", nowIso });

  return {
    assumptions: {
      ...scenarioPreview.assumptions,
      baseMonth,
    },
    members: scenarioPreview.members,
    assets: scenarioPreview.assets,
    liabilities: scenarioPreview.liabilities,
    events: scenarioPreview.events,
    meta: lifecycle.meta,
    clientComputed: lifecycle.clientComputed,
    baseCurrency: scenarioPreview.baseCurrency,
  };
};
