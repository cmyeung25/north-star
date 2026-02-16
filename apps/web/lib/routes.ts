type BuildAppScenarioUrlInput = {
  caseId: string;
  scenarioId: string;
  locale?: string;
};

const normalizeLocale = (locale?: string) => {
  if (!locale) {
    return "";
  }

  const trimmed = locale.trim().replace(/^\/+|\/+$/g, "");
  return trimmed.length > 0 ? `/${trimmed}` : "";
};

export const buildAppScenarioUrl = ({ caseId, scenarioId, locale }: BuildAppScenarioUrlInput) => {
  const localePrefix = normalizeLocale(locale);
  return `${localePrefix}/app/case/${caseId}/scenario/${scenarioId}`;
};
