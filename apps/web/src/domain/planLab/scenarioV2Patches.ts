import type { ScenarioV2 } from "../../engine/scenarioV2Compiler";
import type { ScenarioEvent } from "../scenarioV2/events";
import type {
  BudgetRule,
  ScenarioAssumptions,
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
  assumptions: Partial<ScenarioAssumptions>;
};

export const emptyPlanLabScenarioV2Patches = (): PlanLabScenarioV2Patches => ({
  events: { add: [], update: {}, remove: [] },
  assets: { add: [], update: {}, remove: [] },
  liabilities: { add: [], update: {}, remove: [] },
  members: { add: [], update: {}, remove: [] },
  rules: { add: [], update: {}, remove: [] },
  assumptions: {},
});

const synthesizeAssetsFromEvents = (events: ScenarioEvent[] | undefined): ScenarioAsset[] =>
  (events ?? []).flatMap((event) => {
    if (event.type !== "housing") {
      return [];
    }
    const purchasePrice = event.purchasePrice ?? 0;
    if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
      return [];
    }
    return [
      {
        id: event.propertyAssetId ?? event.id,
        kind: "home" as const,
        label: event.label,
        ownerMemberId: event.memberId,
        currentValue: purchasePrice,
        startMonth: event.startMonth,
        source: "eventGenerated" as const,
        createdByEventId: event.id,
        createdByTemplate: "housing_mortgage" as const,
        metadata: {
          source: "plan-lab" as const,
          origin: event.id,
          ruleId: "plan-lab.housing.asset.v1",
        },
      },
    ];
  });

const synthesizeLiabilitiesFromEvents = (
  events: ScenarioEvent[] | undefined
): ScenarioLiability[] =>
  (events ?? []).flatMap((event) => {
    if (event.type !== "housing" || event.kind !== "mortgage") {
      return [];
    }
    const principal = Math.max(
      0,
      (event.purchasePrice ?? 0) -
        (event.downPaymentAmount ??
          ((event.purchasePrice ?? 0) * (event.downPaymentPercent ?? 0)) / 100)
    );
    return [
      {
        id: event.mortgageLiabilityId ?? event.id,
        kind: "mortgage" as const,
        label: event.label,
        ownerMemberId: event.memberId,
        principalOutstanding: principal || undefined,
        annualInterestRatePct: event.mortgageRatePct,
        termYears: event.mortgageTermYears,
        startMonth: event.startMonth,
        source: "eventGenerated" as const,
        createdByEventId: event.id,
        createdByTemplate: "housing_mortgage" as const,
        metadata: {
          source: "plan-lab" as const,
          origin: event.id,
          ruleId: "plan-lab.housing.liability.v1",
        },
      },
    ];
  });

const mergeUniqueById = <T extends { id: string }>(
  base: T[] | undefined,
  extras: T[]
): T[] => {
  const merged = [...(base ?? [])];
  const ids = new Set(merged.map((item) => item.id));
  extras.forEach((item) => {
    if (ids.has(item.id)) {
      return;
    }
    ids.add(item.id);
    merged.push(item);
  });
  return merged;
};

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
): ScenarioV2 => {
  const nextEvents = applyPatchSet(scenario.events, patches.events);
  const explicitAssets = applyPatchSet(scenario.assets, patches.assets);
  const explicitLiabilities = applyPatchSet(scenario.liabilities, patches.liabilities);

  const synthesizedAssets = synthesizeAssetsFromEvents(nextEvents);
  const synthesizedLiabilities = synthesizeLiabilitiesFromEvents(nextEvents);

  return {
    ...scenario,
    assumptions: {
      ...scenario.assumptions,
      ...patches.assumptions,
    },
    events: nextEvents,
    assets: mergeUniqueById(explicitAssets, synthesizedAssets),
    liabilities: mergeUniqueById(explicitLiabilities, synthesizedLiabilities),
    members: applyPatchSet(scenario.members, patches.members),
  };
};
