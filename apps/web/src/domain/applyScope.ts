export type ApplyScope =
  | { scope: "all" }
  | { scope: "include"; scenarioIds: string[] }
  | { scope: "exclude"; scenarioIds: string[] };

export const appliesToScenario = (
  applyScope: ApplyScope | undefined,
  scenarioId: string
): boolean => {
  if (!applyScope || applyScope.scope === "all") {
    return true;
  }

  const scenarioIds = applyScope.scenarioIds ?? [];
  if (applyScope.scope === "include") {
    return scenarioIds.includes(scenarioId);
  }

  return !scenarioIds.includes(scenarioId);
};
