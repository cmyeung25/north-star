import type { PlanLabScenarioV2Patches } from "../../src/domain/planLab/scenarioV2Patches";

export type PlanLabExperimentGroup = {
  experimentId: string;
  title: string;
  isEnabled: boolean;
  itemIds: string[];
  removedItems?: PlanLabExperimentRemovedItem[];
  bundleInstanceId?: string;
  templateId?: string;
  primaryEventId?: string;
  createdAt: number;
};

export type PlanLabExperimentRemovedItemMeta = {
  label?: string | null;
  type: string;
  amount?: number | null;
  startMonth?: string | null;
  endMonth?: string | null;
  memberName?: string | null;
};

export type PlanLabExperimentRemovedItem = {
  itemId: string;
  removedAt: number;
  meta: PlanLabExperimentRemovedItemMeta;
};

const getActiveGroupItemIds = (group: PlanLabExperimentGroup): string[] => {
  if (!group.removedItems || group.removedItems.length === 0) {
    return group.itemIds;
  }
  const removed = new Set(group.removedItems.map((item) => item.itemId));
  return group.itemIds.filter((itemId) => !removed.has(itemId));
};

const EXPERIMENT_TITLE_FALLBACKS: Record<string, string> = {
  life_home_purchase: "置業買樓",
  life_new_baby: "新生兒計劃",
  life_new_baby_plan: "新生兒計劃",
};

const looksLikeInternalId = (value: string) => /[_:]/.test(value);

const humanizeId = (value: string): string =>
  value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

export const resolveExperimentGroupTitle = (title?: string | null): string => {
  const trimmed = title?.trim();
  if (!trimmed) {
    return "未命名實驗";
  }
  if (EXPERIMENT_TITLE_FALLBACKS[trimmed]) {
    return EXPERIMENT_TITLE_FALLBACKS[trimmed];
  }
  if (looksLikeInternalId(trimmed)) {
    const humanized = humanizeId(trimmed);
    return humanized || "未命名實驗";
  }
  return trimmed;
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
  const grouped = new Set(groups.flatMap((group) => getActiveGroupItemIds(group)));
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
    groups
      .filter((group) => group.isEnabled === false)
      .flatMap((group) => getActiveGroupItemIds(group))
  );
  const removed = new Set(
    groups.flatMap((group) => group.removedItems?.map((item) => item.itemId) ?? [])
  );
  const excluded = new Set([...disabled, ...removed]);
  if (excluded.size === 0) {
    return patches;
  }

  const excludedByEntity: Record<PatchEntity, Set<string>> = {
    events: new Set<string>(),
    assets: new Set<string>(),
    liabilities: new Set<string>(),
    members: new Set<string>(),
    rules: new Set<string>(),
  };
  excluded.forEach((itemId) => {
    const parsed = parseItemId(itemId);
    if (!parsed) {
      return;
    }
    excludedByEntity[parsed.entity].add(parsed.id);
  });

  const filterPatchSet = <T extends { id: string }>(
    patchSet: { add: T[]; update: Record<string, Partial<T>>; remove: string[] },
    excludedIds: Set<string>
  ) => {
    if (excludedIds.size === 0) {
      return {
        add: [...patchSet.add],
        update: { ...patchSet.update },
        remove: [...patchSet.remove],
      };
    }
    const nextUpdate = Object.fromEntries(
      Object.entries(patchSet.update).filter(([id]) => !excludedIds.has(id))
    );
    return {
      add: patchSet.add.filter((item) => !excludedIds.has(item.id)),
      update: nextUpdate,
      remove: patchSet.remove.filter((id) => !excludedIds.has(id)),
    };
  };

  const filtered: PlanLabScenarioV2Patches = {
    ...patches,
    events: filterPatchSet(patches.events, excludedByEntity.events),
    assets: filterPatchSet(patches.assets, excludedByEntity.assets),
    liabilities: filterPatchSet(patches.liabilities, excludedByEntity.liabilities),
    members: filterPatchSet(patches.members, excludedByEntity.members),
    rules: filterPatchSet(patches.rules, excludedByEntity.rules),
  };

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

const normalizeSingleItemLabel = (label?: string | null): string | null => {
  const trimmed = label?.trim();
  return trimmed ? trimmed : null;
};

export const resolveSingleItemExperimentTitle = (label?: string | null): string => {
  const normalizedLabel = normalizeSingleItemLabel(label);
  return normalizedLabel ? `實驗：${normalizedLabel}` : "實驗：單一項目";
};

export const createSingleItemExperimentGroup = (params: {
  experimentId: string;
  itemId: string;
  itemLabel?: string | null;
  createdAt?: number;
}): PlanLabExperimentGroup => ({
  experimentId: params.experimentId,
  title: resolveSingleItemExperimentTitle(params.itemLabel),
  isEnabled: true,
  itemIds: [params.itemId],
  primaryEventId: params.itemId.startsWith("events:")
    ? params.itemId.replace("events:", "")
    : undefined,
  createdAt: params.createdAt ?? Date.now(),
});
