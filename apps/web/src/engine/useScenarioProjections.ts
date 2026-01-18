import { useMemo } from "react";
import { computeProjection, type ProjectionInput, type ProjectionResult } from "@north-star/engine";
import type { BudgetRule, Scenario, ScenarioMember } from "../store/scenarioStore";
import type { EventDefinition } from "../domain/events/types";
import { mapScenarioToEngineInput } from "./adapter";

export type ScenarioProjection = {
  scenarioId: string;
  scenario: Scenario;
  input: ProjectionInput;
  projection: ProjectionResult;
};

const buildHash = (value: unknown) => JSON.stringify(value ?? {});

export const useScenarioProjections = (
  scenarios: Scenario[],
  eventLibrary: EventDefinition[],
  scenarioIds: string[],
  options?: {
    horizonMonths?: number;
    members?: ScenarioMember[];
    budgetRules?: BudgetRule[];
  }
): ScenarioProjection[] => {
  const globalAssumptionsHash = useMemo(
    () =>
      buildHash({
        horizonMonths: options?.horizonMonths ?? null,
        members: options?.members ?? [],
        budgetRules: options?.budgetRules ?? [],
      }),
    [options?.budgetRules, options?.horizonMonths, options?.members]
  );
  const scenarioHashes = useMemo(() => {
    const lookup = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
    return scenarioIds
      .map((scenarioId) => {
        const scenario = lookup.get(scenarioId);
        return `${scenarioId}:${globalAssumptionsHash}:${buildHash(
          scenario?.assumptions
        )}`;
      })
      .join("|");
  }, [globalAssumptionsHash, scenarioIds, scenarios]);

  return useMemo(() => {
    const hashSnapshot = scenarioHashes;
    const scenarioLookup = new Map(scenarios.map((scenario) => [scenario.id, scenario]));

    void hashSnapshot;
    return scenarioIds.flatMap((scenarioId) => {
      const scenario = scenarioLookup.get(scenarioId);
      if (!scenario) {
        return [];
      }

      const { input } = mapScenarioToEngineInput(scenario, eventLibrary, {
        strict: false,
        horizonMonths: options?.horizonMonths,
        members: options?.members ?? [],
        budgetRules: options?.budgetRules ?? [],
      });
      const projection = computeProjection(input);

      return [
        {
          scenarioId,
          scenario,
          input,
          projection,
        },
      ];
    });
  }, [
    eventLibrary,
    options?.budgetRules,
    options?.horizonMonths,
    options?.members,
    scenarioHashes,
    scenarioIds,
    scenarios,
  ]);
};
