import { computeProjection, type ProjectionResult } from "@north-star/engine";
import { useMemo } from "react";
import type { Scenario } from "../store/scenarioStore";
import type { EventDefinition } from "../domain/events/types";
import { mapScenarioToEngineInput, projectionToOverviewViewModel } from "./adapter";
import { normalizeProjection } from "./rentVsOwnComparison";
import { applyStressPreset, type StressPreset } from "./stressTransforms";

export type StressDeltas = {
  netWorthDeltaAtHorizon: number;
  cashDeltaAtHorizon?: number;
  breakevenDeltaMonths?: number | null;
  breakevenMonth?: string | null;
};

export const computeStressDeltas = (
  baselineProjection: ProjectionResult,
  stressedProjection: ProjectionResult
): StressDeltas | null => {
  const baselineSeries = normalizeProjection(baselineProjection);
  const stressedSeries = normalizeProjection(stressedProjection);
  const length = Math.min(baselineSeries.length, stressedSeries.length);

  if (!length) {
    return null;
  }

  const lastIndex = length - 1;
  const netWorthDeltaAtHorizon =
    (stressedSeries[lastIndex]?.netWorth ?? 0) -
    (baselineSeries[lastIndex]?.netWorth ?? 0);
  const stressedCash = stressedSeries[lastIndex]?.cash;
  const baselineCash = baselineSeries[lastIndex]?.cash;
  const cashDeltaAtHorizon =
    stressedCash != null && baselineCash != null
      ? stressedCash - baselineCash
      : undefined;

  let breakevenIndex = -1;
  for (let index = 0; index < length; index += 1) {
    if ((stressedSeries[index]?.netWorth ?? 0) >= (baselineSeries[index]?.netWorth ?? 0)) {
      breakevenIndex = index;
      break;
    }
  }

  return {
    netWorthDeltaAtHorizon,
    cashDeltaAtHorizon,
    breakevenDeltaMonths: breakevenIndex >= 0 ? breakevenIndex : null,
    breakevenMonth: breakevenIndex >= 0 ? stressedSeries[breakevenIndex]?.month ?? null : null,
  };
};

type StressComparisonOptions = {
  shockMonth?: string;
};

export const useStressComparison = (
  scenario: Scenario | null,
  eventLibrary: EventDefinition[],
  preset: StressPreset | null,
  options: StressComparisonOptions = {}
) => {
  return useMemo(() => {
    if (!scenario) {
      return null;
    }

    const { input: baselineInput } = mapScenarioToEngineInput(scenario, eventLibrary);
    const stressedScenario = preset
      ? applyStressPreset(scenario, eventLibrary, preset, {
          shockMonth: options.shockMonth,
        })
      : scenario;
    const stressedInput = mapScenarioToEngineInput(stressedScenario, eventLibrary, {
      baseMonth: baselineInput.baseMonth,
      horizonMonths: baselineInput.horizonMonths,
      initialCash: baselineInput.initialCash,
    }).input;

    const baselineProjection = computeProjection(baselineInput);
    const stressedProjection = computeProjection(stressedInput);
    const baselineView = projectionToOverviewViewModel(baselineProjection);
    const stressedView = projectionToOverviewViewModel(stressedProjection);
    const deltas = computeStressDeltas(baselineProjection, stressedProjection);

    return {
      baselineProjection,
      stressedProjection,
      baselineView,
      stressedView,
      deltas,
    };
  }, [eventLibrary, options.shockMonth, preset, scenario]);
};
