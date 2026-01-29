import type { ProjectionResult } from "@north-star/engine";
import type { AdapterWarning } from "../../src/engine/adapter";
import { projectionToOverviewViewModel } from "../../src/engine/adapter";
import { computeProjectionWithSmartInvest } from "../../src/engine/useProjectionWithLedger";
import type { EventDefinition } from "../../src/domain/events/types";
import { applyPlanPatches } from "../../src/domain/planLab/applyPlanPatches";
import { buildPlanLabDraftFromPatches } from "../../src/domain/planLab/planPatches";
import type { PlanLabDraft, PlanSnapshot } from "../../src/domain/planLab/types";
import type { BudgetRule, Scenario, ScenarioMember } from "../../src/store/scenarioStore";

export type PlanProjectionResult = {
  projection: ProjectionResult | null;
  overview: ReturnType<typeof projectionToOverviewViewModel> | null;
  warnings: AdapterWarning[];
  errors: string[];
};

export type PlanSnapshotValidation = {
  warnings: Array<{
    messageKey: string;
    defaultMessage: string;
  }>;
};

export const buildPlanLabDraftFromSnapshot = (
  snapshot: PlanSnapshot | null | undefined
): PlanLabDraft => buildPlanLabDraftFromPatches(snapshot?.patches ?? []);

export const validatePlanSnapshot = (
  snapshot: PlanSnapshot,
  scenario: Scenario,
  eventLibrary: EventDefinition[],
  members: ScenarioMember[],
  budgetRules: BudgetRule[]
): PlanSnapshotValidation => {
  const { warnings } = applyPlanPatches({
    scenario,
    patches: snapshot.patches,
    eventLibrary,
    budgetRules,
    members,
  });
  return {
    warnings: warnings ?? [],
  };
};

export const getProjectionForPlanSnapshot = (
  snapshot: PlanSnapshot,
  scenario: Scenario,
  eventLibrary: EventDefinition[],
  members: ScenarioMember[],
  budgetRules: BudgetRule[]
): PlanProjectionResult => {
  const applied = applyPlanPatches({
    scenario,
    patches: snapshot.patches,
    eventLibrary,
    members,
    budgetRules,
  });

  try {
    const {
      projection,
      warnings,
    } = computeProjectionWithSmartInvest(
      applied.scenario ?? scenario,
      applied.eventLibrary,
      {
        members: applied.members,
        budgetRules: applied.budgetRules,
      }
    );
    return {
      projection,
      overview: projection ? projectionToOverviewViewModel(projection) : null,
      warnings: [...warnings, ...applied.warnings],
      errors: [],
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown projection error.";
    return {
      projection: null,
      overview: null,
      warnings: [...applied.warnings],
      errors: [message],
    };
  }
};
