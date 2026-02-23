import { type Locale } from "../../src/i18n/routing";
import { memberCasesPath, scenarioSettingsPath } from "./canonicalRoutes";

type SearchParamValue = string | string[] | undefined;

const pickSingleParam = (value: SearchParamValue) =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

export const resolveLegacySettingsRedirectPath = (
  locale: string,
  searchParams?: Record<string, SearchParamValue>
) => {
  const caseId = pickSingleParam(searchParams?.caseId);
  const scenarioId = pickSingleParam(searchParams?.scenarioId);
  const localeValue = locale as Locale;

  if (caseId && scenarioId) {
    return scenarioSettingsPath(caseId, scenarioId, localeValue);
  }

  return memberCasesPath(localeValue);
};
