import type { SubmitScenarioDraftInput } from "../../domain/scenarioDraft/submitScenarioDraft";
import type { Scenario } from "../../store/scenarioStore";

export const buildScenarioDraftFromOnboardingState = ({
  scenarioPreview,
  nowIso,
}: {
  scenarioPreview: Scenario;
  nowIso: string;
}): SubmitScenarioDraftInput["draft"] => ({
  assumptions: scenarioPreview.assumptions,
  members: scenarioPreview.members,
  assets: scenarioPreview.assets,
  liabilities: scenarioPreview.liabilities,
  events: scenarioPreview.events,
  meta: {
    schemaVersion: 2,
    onboarded: true,
    onboardedAt: nowIso,
    onboardingVersion: 2,
    lastSavedAt: nowIso,
  },
  clientComputed: { onboardingCompleted: true },
  baseCurrency: scenarioPreview.baseCurrency,
});
