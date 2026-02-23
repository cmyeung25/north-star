import {
  caseEnterPath,
  memberCasesPath as canonicalMemberCasesPath,
  scenarioDashboardPath,
  scenarioMoneyPath,
  scenarioOnboardingPath,
  scenarioPath,
  scenarioPeoplePath,
  scenarioPlanLabPath,
  scenarioSettingsPath,
} from "./canonicalRoutes";

const encodePathSegment = (value: string) => encodeURIComponent(value);

const hasPathValue = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const memberCasesPath = (caseId?: string | null) =>
  hasPathValue(caseId)
    ? `${canonicalMemberCasesPath()}/${encodePathSegment(caseId)}`
    : canonicalMemberCasesPath();

export const scenarioBasePath = (caseId: string, scenarioId: string) =>
  scenarioPath(caseId, scenarioId);

export const memberCaseEnterPath = (caseId: string) => caseEnterPath(caseId);

export {
  scenarioDashboardPath,
  scenarioMoneyPath,
  scenarioOnboardingPath,
  scenarioPath,
  scenarioPeoplePath,
  scenarioPlanLabPath,
  scenarioSettingsPath,
};
