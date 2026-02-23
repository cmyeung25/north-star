const LEGACY_PEOPLE_ROUTE_COUNTER_KEY = "__north_star_legacy_people_route_hits";

type LegacyPeopleRouteHit = {
  locale: string;
  hasCaseId: boolean;
  hasScenarioId: boolean;
};

type LegacyPeopleRouteCounters = {
  total: number;
  withCaseId: number;
  withScenarioId: number;
  withBothIds: number;
  missingAnyId: number;
};

const readCounters = (): LegacyPeopleRouteCounters => {
  const globalState = globalThis as typeof globalThis & {
    [LEGACY_PEOPLE_ROUTE_COUNTER_KEY]?: LegacyPeopleRouteCounters;
  };

  if (!globalState[LEGACY_PEOPLE_ROUTE_COUNTER_KEY]) {
    globalState[LEGACY_PEOPLE_ROUTE_COUNTER_KEY] = {
      total: 0,
      withCaseId: 0,
      withScenarioId: 0,
      withBothIds: 0,
      missingAnyId: 0,
    };
  }

  return globalState[LEGACY_PEOPLE_ROUTE_COUNTER_KEY]!;
};

export const recordLegacyPeopleRouteHit = ({
  locale,
  hasCaseId,
  hasScenarioId,
}: LegacyPeopleRouteHit) => {
  const counters = readCounters();
  counters.total += 1;
  if (hasCaseId) {
    counters.withCaseId += 1;
  }
  if (hasScenarioId) {
    counters.withScenarioId += 1;
  }

  if (hasCaseId && hasScenarioId) {
    counters.withBothIds += 1;
  } else {
    counters.missingAnyId += 1;
  }

  console.info("[legacy-people-route] compatibility hit", {
    locale,
    hasCaseId,
    hasScenarioId,
    counters,
  });
};
