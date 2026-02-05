import type { PlanLabScenarioV2Patches } from "../../src/domain/planLab/scenarioV2Patches";

export type PlanLabExperimentGroup = {
  experimentId: string;
  title: string;
  isEnabled: boolean;
  itemIds: string[];
  createdAt: number;
};

type PatchEntity = keyof PlanLabScenarioV2Patches;

const ENTITY_ORDER: PatchEntity[] = ["events", "assets", "liabilities", "members", "rules"];

const buildItemId = (entity: PatchEntity, id: string) => `${entity}:${id}`;

export const collectPatchItemIds = (patches: PlanLabScenarioV2Patches): string[] => {
  const ids: string[] = [];
  ENTITY_ORDER.forEach((entity) => {
    patches[entity].add.forEach((item) => ids.push(buildItemId(entity, item.id)));
  });
  return ids;
};

export const collectUngroupedPatchItemIds = (
  patches: PlanLabScenarioV2Patches,
  groups: PlanLabExperimentGroup[]
): string[] => {
  const grouped = new Set(groups.flatMap((group) => group.itemIds));
  return collectPatchItemIds(patches).filter((itemId) => !grouped.has(itemId));
};

const parseItemId = (itemId: string): { entity: PatchEntity; id: string } | null => {
  const [entity, ...parts] = itemId.split(":");
  if (!ENTITY_ORDER.includes(entity as PatchEntity) || parts.length === 0) {
    return null;
  }
  return { entity: entity as PatchEntity, id: parts.join(":") };
};

export const filterScenarioV2PatchesByExperimentGroups = (
  patches: PlanLabScenarioV2Patches,
  groups: PlanLabExperimentGroup[]
): PlanLabScenarioV2Patches => {
  const disabled = new Set(
    groups.filter((group) => group.isEnabled === false).flatMap((group) => group.itemIds)
  );
  if (disabled.size === 0) {
    return patches;
  }

  const filtered: PlanLabScenarioV2Patches = {
    ...patches,
    events: { ...patches.events, add: [...patches.events.add] },
    assets: { ...patches.assets, add: [...patches.assets.add] },
    liabilities: { ...patches.liabilities, add: [...patches.liabilities.add] },
    members: { ...patches.members, add: [...patches.members.add] },
    rules: { ...patches.rules, add: [...patches.rules.add] },
  };

  filtered.events.add = filtered.events.add.filter(
    (item) => !disabled.has(buildItemId("events", item.id))
  );
  filtered.assets.add = filtered.assets.add.filter(
    (item) => !disabled.has(buildItemId("assets", item.id))
  );
  filtered.liabilities.add = filtered.liabilities.add.filter(
    (item) => !disabled.has(buildItemId("liabilities", item.id))
  );
  filtered.members.add = filtered.members.add.filter(
    (item) => !disabled.has(buildItemId("members", item.id))
  );
  filtered.rules.add = filtered.rules.add.filter(
    (item) => !disabled.has(buildItemId("rules", item.id))
  );

  return filtered;
};

export const removeExperimentGroupItemsFromPatches = (
  patches: PlanLabScenarioV2Patches,
  group: PlanLabExperimentGroup
): PlanLabScenarioV2Patches => {
  const removals = {
    events: new Set<string>(),
    assets: new Set<string>(),
    liabilities: new Set<string>(),
    members: new Set<string>(),
    rules: new Set<string>(),
  };

  group.itemIds.forEach((itemId) => {
    const parsed = parseItemId(itemId);
    if (!parsed) {
      return;
    }
    removals[parsed.entity].add(parsed.id);
  });

  const next: PlanLabScenarioV2Patches = {
    ...patches,
    events: {
      add: patches.events.add.filter((item) => !removals.events.has(item.id)),
      update: { ...patches.events.update },
      remove: [...patches.events.remove],
    },
    assets: {
      add: patches.assets.add.filter((item) => !removals.assets.has(item.id)),
      update: { ...patches.assets.update },
      remove: [...patches.assets.remove],
    },
    liabilities: {
      add: patches.liabilities.add.filter((item) => !removals.liabilities.has(item.id)),
      update: { ...patches.liabilities.update },
      remove: [...patches.liabilities.remove],
    },
    members: {
      add: patches.members.add.filter((item) => !removals.members.has(item.id)),
      update: { ...patches.members.update },
      remove: [...patches.members.remove],
    },
    rules: {
      add: patches.rules.add.filter((item) => !removals.rules.has(item.id)),
      update: { ...patches.rules.update },
      remove: [...patches.rules.remove],
    },
  };

  ENTITY_ORDER.forEach((entity) => {
    removals[entity].forEach((id) => {
      delete next[entity].update[id];
      if (!next[entity].remove.includes(id)) {
        next[entity].remove.push(id);
      }
    });
  });

  return next;
};
