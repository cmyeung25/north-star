import type { ReadonlyURLSearchParams } from "next/navigation";
import {
  scenarioDashboardPath,
  scenarioMoneyPath,
  scenarioPath,
  scenarioPeoplePath,
  scenarioPlanLabPath,
  scenarioSettingsPath,
} from "../../lib/routes/appRoutes";
import type { Scenario } from "../store/scenarioStore";
import { resolveScenarioIdFromQuery } from "../store/scenarioStore";

type SearchParams = Pick<ReadonlyURLSearchParams, "get"> | URLSearchParams | null;

export const getScenarioIdFromSearchParams = (searchParams: SearchParams) => {
  if (!searchParams) {
    return null;
  }

  return searchParams.get("scenarioId");
};

export const resolveScenarioId = (
  searchParams: SearchParams,
  activeScenarioId: string,
  scenarios: Scenario[]
) => {
  return resolveScenarioIdFromQuery(
    getScenarioIdFromSearchParams(searchParams),
    activeScenarioId,
    scenarios
  );
};

type ScenarioRoutePath = "/dashboard" | "/settings" | "/money" | "/people" | "/plan-lab" | "/stress";

const warnBuildScenarioUrlUsage = (
  path: ScenarioRoutePath,
  caseId: string,
  scenarioId: string
) => {
  if (process.env.NODE_ENV === "development") {
    console.warn("[scenarioContext] buildScenarioUrl is deprecated", {
      path,
      caseId,
      scenarioId,
    });
  }
};

export const buildScenarioUrl = (
  path: ScenarioRoutePath,
  caseId: string,
  scenarioId: string
) => {
  warnBuildScenarioUrlUsage(path, caseId, scenarioId);

  switch (path) {
    case "/dashboard":
      return scenarioDashboardPath(caseId, scenarioId);
    case "/money":
      return scenarioMoneyPath(caseId, scenarioId);
    case "/people":
      return scenarioPeoplePath(caseId, scenarioId);
    case "/settings":
      return scenarioSettingsPath(caseId, scenarioId);
    case "/plan-lab":
      return scenarioPlanLabPath(caseId, scenarioId);
    case "/stress":
      return scenarioPath(caseId, scenarioId, "stress");
    default:
      return scenarioDashboardPath(caseId, scenarioId);
  }
};

export const buildMoneyAssetsUrl = (
  caseId: string,
  scenarioId: string,
  options?: { focus?: "cash" }
) => {
  const base = buildScenarioUrl("/money", caseId, scenarioId);
  const [pathname, queryString] = base.split("?");
  const query = new URLSearchParams(queryString ?? "");
  query.set("tab", "assets");
  if (options?.focus) {
    query.set("focus", options.focus);
  }
  const hash = options?.focus === "cash" ? "#cash" : "";
  return `${pathname}?${query.toString()}${hash}`;
};
