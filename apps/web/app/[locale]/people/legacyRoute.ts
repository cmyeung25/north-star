import { memberCasesPath, scenarioPeoplePath } from "../../../lib/routes/canonicalRoutes";
import { recordLegacyPeopleRouteHit } from "../../../src/lib/telemetry/legacyPeopleRouteTelemetry";
import { type Locale } from "../../../src/i18n/routing";

export const resolveLegacyPeopleRouteRedirect = (
  locale: Locale,
  searchParams?: Record<string, string | string[] | undefined>,
) => {
  const caseId = typeof searchParams?.caseId === "string" ? searchParams.caseId : undefined;
  const scenarioId =
    typeof searchParams?.scenarioId === "string" ? searchParams.scenarioId : undefined;
  const tab = typeof searchParams?.tab === "string" ? searchParams.tab : undefined;
  const add = typeof searchParams?.add === "string" ? searchParams.add : undefined;
  const ruleId = typeof searchParams?.ruleId === "string" ? searchParams.ruleId : undefined;

  // DEPRECATION WINDOW (legacy compatibility):
  // Keep this route only for backward compatibility with query-based links (/people?caseId=...&scenarioId=...).
  // Canonical navigation must use /app/case/:caseId/scenario/:scenarioId/people.
  recordLegacyPeopleRouteHit({
    locale,
    hasCaseId: Boolean(caseId),
    hasScenarioId: Boolean(scenarioId),
  });

  if (caseId && scenarioId) {
    const query = new URLSearchParams();
    if (tab) {
      query.set("tab", tab);
    }
    if (add) {
      query.set("add", add);
    }
    if (ruleId) {
      query.set("ruleId", ruleId);
    }

    const pathname = scenarioPeoplePath(caseId, scenarioId, locale);
    return `${pathname}${query.size > 0 ? `?${query.toString()}` : ""}`;
  }

  // POST-MIGRATION BEHAVIOR (kept enabled to avoid accidental fallback rendering):
  // If identifiers are missing, do not render PeopleWorkspace from this legacy route.
  // Redirect safely to member cases instead.
  return memberCasesPath(locale);
};
