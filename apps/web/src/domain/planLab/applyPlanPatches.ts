import type { EventDefinition } from "../events/types";
import type { BudgetRule, Scenario, ScenarioMember } from "../../store/scenarioStore";
import { compilePlanLabDraft } from "./compilePlanLabDraft";
import type { PlanPatch } from "./types";
import { buildPlanLabDraftFromPatches, validatePlanPatches } from "./planPatches";
import type { CompilerWarning } from "../warnings/types";

export type ApplyPlanPatchesResult = {
  scenario: Scenario | null;
  eventLibrary: EventDefinition[];
  members: ScenarioMember[];
  budgetRules: BudgetRule[];
  warnings: CompilerWarning[];
};

const applyEventRefOverrides = (
  refs: Scenario["eventRefs"] | undefined,
  overrides: Scenario["eventRefs"] | undefined
) => {
  if (!refs || refs.length === 0 || !overrides || overrides.length === 0) {
    return refs ?? [];
  }
  const overridesById = new Map(overrides.map((override) => [override.refId, override]));
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

export const applyPlanPatches = ({
  scenario,
  patches,
  eventLibrary,
  members,
  budgetRules,
}: {
  scenario: Scenario | null | undefined;
  patches: PlanPatch[];
  eventLibrary: EventDefinition[];
  members: ScenarioMember[];
  budgetRules: BudgetRule[];
}): ApplyPlanPatchesResult => {
  if (!scenario) {
    return {
      scenario: null,
      eventLibrary,
      members,
      budgetRules,
      warnings: [],
    };
  }

  const draft = buildPlanLabDraftFromPatches(patches);
  const planLabCompilation = compilePlanLabDraft(draft, {
    baselineScenario: scenario,
    eventLibrary,
    budgetRules,
    members,
  });

  const eventRefsWithOverrides = applyEventRefOverrides(
    scenario.eventRefs,
    planLabCompilation.eventRefOverrides
  );

  const sandboxScenario: Scenario = {
    ...scenario,
    assumptions: {
      ...scenario.assumptions,
      ...planLabCompilation.assumptions,
    },
    positions: {
      ...(scenario.positions ?? {}),
      ...planLabCompilation.positions,
    },
    eventRefs: [...eventRefsWithOverrides, ...planLabCompilation.eventRefs],
  };

  const warnings = [
    ...planLabCompilation.warnings,
    ...validatePlanPatches(patches, scenario, budgetRules, members),
  ];

  return {
    scenario: sandboxScenario,
    eventLibrary: [...eventLibrary, ...planLabCompilation.eventDefinitions],
    members: planLabCompilation.members ?? members,
    budgetRules: planLabCompilation.budgetRules ?? budgetRules,
    warnings,
  };
};
