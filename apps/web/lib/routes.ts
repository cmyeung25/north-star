import { scenarioPath } from "./routes/appRoutes";

type BuildAppScenarioUrlInput = {
  caseId: string;
  scenarioId: string;
};

export const buildAppScenarioUrl = ({ caseId, scenarioId }: BuildAppScenarioUrlInput) => {
  return scenarioPath(caseId, scenarioId);
};
