import type { SubmitScenarioDraftPayload } from "../../../domain/scenarioDraft/submitScenarioDraft";

export type OnboardingV3SubmissionFacade = {
  updateScenarioBaseCurrency: (id: string, baseCurrency: string) => void;
  updateScenarioAssumptions: (id: string, assumptions: SubmitScenarioDraftPayload["assumptions"]) => void;
  setScenarioMembers: (id: string, members: SubmitScenarioDraftPayload["members"]) => void;
  setScenarioAssets: (id: string, assets: SubmitScenarioDraftPayload["assets"]) => void;
  setScenarioLiabilities: (id: string, liabilities: SubmitScenarioDraftPayload["liabilities"]) => void;
  setScenarioEvents: (id: string, events: SubmitScenarioDraftPayload["events"]) => void;
  updateScenarioMeta: (id: string, meta: SubmitScenarioDraftPayload["meta"]) => void;
  updateScenarioClientComputed: (id: string, clientComputed: SubmitScenarioDraftPayload["clientComputed"]) => void;
};

export const submitOnboardingV3Payload = (
  scenarioId: string,
  payload: SubmitScenarioDraftPayload,
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
