import type { ProjectionResult } from "@north-star/engine";
import type { AdapterWarning } from "../../src/engine/adapter";
import { projectionToOverviewViewModel } from "../../src/engine/adapter";
import { computeProjectionWithSmartInvest } from "../../src/engine/useProjectionWithLedger";
import type { EventDefinition } from "../../src/domain/events/types";
import { compilePlanLabDraft } from "../../src/domain/planLab/compilePlanLabDraft";
import type {
  PlanLabDraft,
  PlanLabSnapshot,
  PlanSnapshot,
} from "../../src/domain/planLab/types";
import type { CompilerWarning } from "../../src/domain/warnings/types";
import type { BudgetRule, Scenario, ScenarioMember } from "../../src/store/scenarioStore";
import { applyPlanPatches } from "../../src/domain/planLab/applyPlanPatches";

export type PlanProjectionResult = {
  projection: ProjectionResult | null;
  overview: ReturnType<typeof projectionToOverviewViewModel> | null;
  warnings: AdapterWarning[];
  errors: string[];
};

export type PlanSnapshotValidation = {
  warnings: CompilerWarning[];
};

export const buildPlanLabDraftFromSnapshot = (
  snapshot: PlanLabSnapshot | null | undefined
): PlanLabDraft => ({
  baselinePatches: snapshot?.baselinePatches,
  experiments: snapshot?.experiments,
  scorecardSettings: snapshot?.scorecardSettings,
});

export const validatePlanSnapshot = (
  snapshot: PlanLabSnapshot,
  scenario: Scenario,
  eventLibrary: EventDefinition[],
  members: ScenarioMember[],
  budgetRules: BudgetRule[]
): PlanSnapshotValidation => {
  const draft = buildPlanLabDraftFromSnapshot(snapshot);
  const compilation = compilePlanLabDraft(draft, {
    baselineScenario: scenario,
    eventLibrary,
    budgetRules,
    members,
  });
  return {
    warnings: compilation.warnings ?? [],
  };
};

export const getProjectionForPlanSnapshot = (
  plan: PlanSnapshot,
  scenario: Scenario,
  eventLibrary: EventDefinition[],
  members: ScenarioMember[],
  budgetRules: BudgetRule[]
): PlanProjectionResult => {
  const applyResult = applyPlanPatches({
    scenario,
    snapshot: plan.snapshot,
    patches: plan.patches ?? [],
    eventLibrary,
    budgetRules,
    members,
  });
  const sandboxScenario = applyResult.scenario;
  const combinedEventLibrary = [...eventLibrary, ...applyResult.eventDefinitions];

  try {
    const {
      projection,
      warnings,
    } = computeProjectionWithSmartInvest(sandboxScenario, combinedEventLibrary, {
      members,
      budgetRules,
    });
    return {
      projection,
      overview: projection ? projectionToOverviewViewModel(projection) : null,
      warnings: [
        ...warnings,
        ...applyResult.warnings,
        ...applyResult.patchWarnings,
      ],
      errors: [],
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown projection error.";
    return {
      projection: null,
      overview: null,
      warnings: [...applyResult.warnings, ...applyResult.patchWarnings],
      errors: [message],
    };
  }
};
