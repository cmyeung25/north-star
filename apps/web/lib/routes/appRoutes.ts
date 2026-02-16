const encodePathSegment = (value: string) => encodeURIComponent(value);

export const scenarioBasePath = (caseId: string, scenarioId: string) =>
  `/app/case/${encodePathSegment(caseId)}/scenario/${encodePathSegment(scenarioId)}`;

export const scenarioOnboardingPath = (caseId: string, scenarioId: string) =>
  `${scenarioBasePath(caseId, scenarioId)}/onboarding`;

export const scenarioDashboardPath = (caseId: string, scenarioId: string) =>
  `${scenarioBasePath(caseId, scenarioId)}/dashboard`;

export const scenarioMoneyPath = (caseId: string, scenarioId: string) =>
  `${scenarioBasePath(caseId, scenarioId)}/money`;
