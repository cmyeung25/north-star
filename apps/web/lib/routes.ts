type BuildAppScenarioUrlInput = {
  caseId: string;
  scenarioId: string;
};

export const buildAppScenarioUrl = ({ caseId, scenarioId }: BuildAppScenarioUrlInput) => {
  return `/app/case/${caseId}/scenario/${scenarioId}`;
};
