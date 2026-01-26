import type { ReadonlyURLSearchParams } from "next/navigation";
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

export const buildScenarioUrl = (
  path:
    | "/timeline"
    | "/overview"
    | "/dashboard"
    | "/stress"
    | "/settings"
    | "/money"
    | "/people"
    | "/plan-lab",
  scenarioId: string
) => `${path}?scenarioId=${scenarioId}`;
