import type { ScenarioV2 } from "../../engine/scenarioV2Compiler";
import type { ScenarioEvent } from "../scenarioV2/events";
import type {
  BudgetRule,
  ScenarioAsset,
  ScenarioLiability,
  ScenarioMember,
} from "../../store/scenarioStore";

type ScenarioV2PatchSet<T extends { id: string }> = {
  add: T[];
  update: Record<string, Partial<T>>;
  remove: string[];
};

export type PlanLabScenarioV2Patches = {
  events: ScenarioV2PatchSet<ScenarioEvent>;
  assets: ScenarioV2PatchSet<ScenarioAsset>;
  liabilities: ScenarioV2PatchSet<ScenarioLiability>;
  members: ScenarioV2PatchSet<ScenarioMember>;
  rules: ScenarioV2PatchSet<BudgetRule>;
};

export const emptyPlanLabScenarioV2Patches = (): PlanLabScenarioV2Patches => ({
  events: { add: [], update: {}, remove: [] },
  assets: { add: [], update: {}, remove: [] },
  liabilities: { add: [], update: {}, remove: [] },
  members: { add: [], update: {}, remove: [] },
  rules: { add: [], update: {}, remove: [] },
});

const applyPatchSet = <T extends { id: string }>(
  base: T[] | undefined,
  patch: ScenarioV2PatchSet<T>
) => {
  const removed = new Set(patch.remove);
  const updated = (base ?? []).flatMap((item) => {
    if (removed.has(item.id)) {
      return [];
    }
    const update = patch.update[item.id];
    if (!update) {
      return [item];
    }
    return [{ ...item, ...update }];
  });

  patch.add.forEach((addition) => {
    if (removed.has(addition.id)) {
      return;
    }
    const existingIndex = updated.findIndex((item) => item.id === addition.id);
    if (existingIndex >= 0) {
      updated[existingIndex] = addition;
      return;
    }
    updated.push(addition);
  });

  return updated;
};

export const applyPlanLabScenarioV2Patches = (
  scenario: ScenarioV2,
  patches: PlanLabScenarioV2Patches
): ScenarioV2 => ({
  ...scenario,
  events: applyPatchSet(scenario.events, patches.events),
  assets: applyPatchSet(scenario.assets, patches.assets),
  liabilities: applyPatchSet(scenario.liabilities, patches.liabilities),
  members: applyPatchSet(scenario.members, patches.members),
});
