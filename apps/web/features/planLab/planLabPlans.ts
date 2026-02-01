import type { ProjectionResult } from "@north-star/engine";
import { computeProjection } from "@north-star/engine";
import type { AdapterWarning } from "../../src/engine/adapter";
import { projectionToOverviewViewModel } from "../../src/engine/adapter";
import type { EventDefinition } from "../../src/domain/events/types";
import { compileScenarioV2ToProjectionInput } from "../../src/engine/scenarioV2Compiler";
import type {
  PlanLabDraft,
  PlanLabSnapshot,
  PlanSnapshot,
} from "../../src/domain/planLab/types";
import type { BudgetRule, Scenario, ScenarioMember } from "../../src/store/scenarioStore";
import { applyPatchToScenario } from "../../src/domain/planLab/snapshotPayload";
import { buildScenarioV2FromScenario } from "../../src/domain/planLab/scenarioV2Bridge";

export type PlanProjectionResult = {
  projection: ProjectionResult | null;
  overview: ReturnType<typeof projectionToOverviewViewModel> | null;
  warnings: AdapterWarning[];
  errors: string[];
};

export const buildPlanLabDraftFromSnapshot = (
  snapshot: PlanLabSnapshot | null | undefined
): PlanLabDraft => ({
  baselinePatches: snapshot?.baselinePatches,
  experiments: snapshot?.experiments,
  scorecardSettings: snapshot?.scorecardSettings,
});

export const getProjectionForPlanSnapshot = (
  plan: PlanSnapshot,
  scenario: Scenario,
  eventLibrary: EventDefinition[],
  members: ScenarioMember[],
  budgetRules: BudgetRule[]
): PlanProjectionResult => {
  try {
    const baselineScenario = buildScenarioV2FromScenario(scenario, eventLibrary);
    const sandboxScenario = applyPatchToScenario(baselineScenario, plan.payload);
    const projectionInput = compileScenarioV2ToProjectionInput(sandboxScenario);
    const projection = computeProjection(projectionInput);
    return {
      projection,
      overview: projection ? projectionToOverviewViewModel(projection) : null,
      warnings: [],
      errors: [],
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown projection error.";
    return {
      projection: null,
      overview: null,
      warnings: [],
      errors: [message],
    };
  }
};
