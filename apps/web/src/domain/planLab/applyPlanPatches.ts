import type { EventDefinition, ScenarioEventRef } from "../events/types";
import type { PlanLabDraft, PlanLabSnapshot, PlanPatch } from "./types";
import type { BudgetRule, Scenario, ScenarioMember } from "../../store/scenarioStore";
import { compilePlanLabDraft } from "./compilePlanLabDraft";
import type { CompilerWarning } from "../warnings/types";
import { validatePlanPatches } from "./planPatches";

type ApplyPlanPatchesInput = {
  scenario: Scenario | null | undefined;
  snapshot: PlanLabSnapshot;
  patches: PlanPatch[];
  eventLibrary: EventDefinition[];
  budgetRules: BudgetRule[];
  members: ScenarioMember[];
};

export type ApplyPlanPatchesResult = {
  scenario: Scenario;
  eventDefinitions: EventDefinition[];
  warnings: CompilerWarning[];
  patchWarnings: CompilerWarning[];
  members: ScenarioMember[];
  budgetRules: BudgetRule[];
};

const applyEventRefOverrides = (
  refs: ScenarioEventRef[] | undefined,
  overrides: ScenarioEventRef[]
) => {
  if (!refs || refs.length === 0 || overrides.length === 0) {
    return refs ?? [];
  }
  const overridesById = new Map(
    overrides.map((override) => [override.refId, override])
  );
  return refs.map((ref) => {
    const override = overridesById.get(ref.refId);
    if (!override) {
      return ref;
    }
    return {
      ...ref,
      enabled: override.enabled ?? ref.enabled,
      overrides: {
        ...(ref.overrides ?? {}),
        ...(override.overrides ?? {}),
      },
    };
  });
};

const buildPlanLabDraftFromSnapshot = (
  snapshot: PlanLabSnapshot
): PlanLabDraft => ({
  baselinePatches: snapshot?.baselinePatches,
  experiments: snapshot?.experiments,
  scorecardSettings: snapshot?.scorecardSettings,
});

export const applyPlanPatches = ({
  scenario,
  snapshot,
  patches,
  eventLibrary,
  budgetRules,
  members,
}: ApplyPlanPatchesInput): ApplyPlanPatchesResult => {
  if (!scenario) {
    throw new Error("Baseline scenario is required for applying plan patches.");
  }

  const draft = buildPlanLabDraftFromSnapshot(snapshot);
  const compilation = compilePlanLabDraft(draft, {
    baselineScenario: scenario,
    eventLibrary,
    budgetRules,
    members,
  });
  const patchWarnings = validatePlanPatches({
    patches,
    scenario,
    eventLibrary,
    budgetRules,
    members,
  });

  const eventRefsWithOverrides = applyEventRefOverrides(
    scenario.eventRefs,
    compilation.eventRefOverrides
  );

  const sandboxScenario: Scenario = {
    ...scenario,
    assumptions: {
      ...scenario.assumptions,
      ...compilation.assumptions,
    },
    positions: {
      ...(scenario.positions ?? {}),
      ...compilation.positions,
    },
    eventRefs: [...eventRefsWithOverrides, ...compilation.eventRefs],
  };

  return {
    scenario: sandboxScenario,
    eventDefinitions: compilation.eventDefinitions,
    warnings: compilation.warnings ?? [],
    patchWarnings,
    members: compilation.members ?? members,
    budgetRules: compilation.budgetRules ?? budgetRules,
  };
};
