import type { ScenarioCreatePayload } from "../../../domain/scenarioDraft/types";

export type OnboardingV3SubmissionFacade = {
  updateScenarioBaseCurrency: (id: string, baseCurrency: string) => void;
  updateScenarioAssumptions: (id: string, assumptions: ScenarioCreatePayload["assumptions"]) => void;
  setScenarioMembers: (id: string, members: ScenarioCreatePayload["members"]) => void;
  setScenarioAssets: (id: string, assets: ScenarioCreatePayload["assets"]) => void;
  setScenarioLiabilities: (id: string, liabilities: ScenarioCreatePayload["liabilities"]) => void;
  setScenarioEvents: (id: string, events: ScenarioCreatePayload["events"]) => void;
  updateScenarioMeta: (id: string, meta: ScenarioCreatePayload["meta"]) => void;
  updateScenarioClientComputed: (id: string, clientComputed: ScenarioCreatePayload["clientComputed"]) => void;
};

export const submitOnboardingV3Payload = (
  scenarioId: string,
  payload: ScenarioCreatePayload,
  facade: OnboardingV3SubmissionFacade
) => {
  facade.updateScenarioBaseCurrency(scenarioId, payload.baseCurrency);
  facade.updateScenarioAssumptions(scenarioId, payload.assumptions);
  facade.setScenarioMembers(scenarioId, payload.members);
  facade.setScenarioAssets(scenarioId, payload.assets);
  facade.setScenarioLiabilities(scenarioId, payload.liabilities);
  facade.setScenarioEvents(scenarioId, payload.events);
  facade.updateScenarioMeta(scenarioId, payload.meta);
  facade.updateScenarioClientComputed(scenarioId, payload.clientComputed);
};
