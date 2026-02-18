import { defaultLocale, type Locale } from "../../src/i18n/routing";

const encodePathSegment = (value: string) => encodeURIComponent(value);

const hasPathValue = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.trim().length > 0;

const localizedPrefix = (locale?: Locale | null) =>
  locale && locale !== defaultLocale ? `/${locale}` : "";

const withLocale = (path: string, locale?: Locale | null) =>
  `${localizedPrefix(locale)}${path}`;

export const marketingHomePath = (locale?: Locale | null) =>
  withLocale("/", locale);

export const memberCasesPath = (locale?: Locale | null) =>
  withLocale("/member/cases", locale);

export const caseEnterPath = (caseId: string, locale?: Locale | null) =>
  withLocale(`/member/cases/${encodePathSegment(caseId)}/enter`, locale);

export const scenarioPath = (
  caseId: string | null | undefined,
  scenarioId: string | null | undefined,
  subPath = "",
  locale?: Locale | null,
) => {
  if (!hasPathValue(caseId) || !hasPathValue(scenarioId)) {
    return memberCasesPath(locale);
  }

  const normalizedSubPath = subPath ? `/${subPath.replace(/^\/+/, "")}` : "";
  return withLocale(
    `/app/case/${encodePathSegment(caseId)}/scenario/${encodePathSegment(scenarioId)}${normalizedSubPath}`,
    locale,
  );
};

export const scenarioDashboardPath = (
  caseId: string,
  scenarioId: string,
  locale?: Locale | null,
) => scenarioPath(caseId, scenarioId, "dashboard", locale);

export const scenarioOnboardingPath = (
  caseId: string,
  scenarioId: string,
  locale?: Locale | null,
) => scenarioPath(caseId, scenarioId, "onboarding", locale);

export const scenarioMoneyPath = (
  caseId: string,
  scenarioId: string,
  locale?: Locale | null,
) => scenarioPath(caseId, scenarioId, "money", locale);

export const scenarioPlanLabPath = (
  caseId: string,
  scenarioId: string,
  locale?: Locale | null,
) => scenarioPath(caseId, scenarioId, "planlab", locale);

export const scenarioSettingsPath = (
  caseId: string,
  scenarioId: string,
  locale?: Locale | null,
) => scenarioPath(caseId, scenarioId, "settings", locale);
