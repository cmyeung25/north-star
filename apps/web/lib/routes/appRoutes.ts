const encodePathSegment = (value: string) => encodeURIComponent(value);

const hasPathValue = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const memberCasesPath = (caseId?: string | null) =>
  hasPathValue(caseId)
    ? `/member/cases/${encodePathSegment(caseId)}`
    : "/member/cases";

export const scenarioPath = (
  caseId: string | null | undefined,
  scenarioId: string | null | undefined,
  subpath = ""
) => {
  if (!hasPathValue(caseId) || !hasPathValue(scenarioId)) {
    return memberCasesPath(caseId);
  }

  const normalizedSubpath = subpath ? `/${subpath.replace(/^\/+/, "")}` : "";
  return `/app/case/${encodePathSegment(caseId)}/scenario/${encodePathSegment(
    scenarioId
  )}${normalizedSubpath}`;
};

export const scenarioBasePath = (caseId: string, scenarioId: string) =>
  scenarioPath(caseId, scenarioId);

export const memberCaseEnterPath = (caseId: string) =>
  `/member/cases/${encodePathSegment(caseId)}/enter`;

export const scenarioOnboardingPath = (caseId: string, scenarioId: string) =>
  scenarioPath(caseId, scenarioId, "onboarding");

export const scenarioDashboardPath = (caseId: string, scenarioId: string) =>
  scenarioPath(caseId, scenarioId, "dashboard");

export const scenarioMoneyPath = (caseId: string, scenarioId: string) =>
  scenarioPath(caseId, scenarioId, "money");

export const scenarioPlanLabPath = (caseId: string, scenarioId: string) =>
  scenarioPath(caseId, scenarioId, "planlab");

export const scenarioSettingsPath = (caseId: string, scenarioId: string) =>
  scenarioPath(caseId, scenarioId, "settings");
