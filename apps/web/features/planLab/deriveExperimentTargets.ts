import type { PlanLabExperimentGroup } from "./experimentGroups";
import type { ScenarioAssumptionsOverride } from "../../components/ScenarioAssumptionsOverrideForm";

type PatchItemMeta = {
  label?: string | null;
  type: string;
};

export type ExperimentTarget =
  | { kind: "event"; id: string; label: string; locateId: string }
  | { kind: "bundle"; id: string; label: string; locateId: string }
  | { kind: "assumption"; key: string; label: string };

const normalizeItemId = (itemId: string): string => {
  if (itemId.startsWith("events:")) {
    return `event:${itemId.replace("events:", "")}`;
  }
  if (itemId.startsWith("rules:")) {
    return `rule:${itemId.replace("rules:", "")}`;
  }
  if (itemId.startsWith("assets:")) {
    return `asset:${itemId.replace("assets:", "")}`;
  }
  if (itemId.startsWith("liabilities:")) {
    return `liability:${itemId.replace("liabilities:", "")}`;
  }
  if (itemId.startsWith("members:")) {
    return `member:${itemId.replace("members:", "")}`;
  }
  return itemId;
};

export const deriveExperimentTargets = (
  group: PlanLabExperimentGroup,
  baselineState: {
    eventLabelById: Map<string, string>;
    bundleLabelById: Map<string, string>;
    assumptionLabelByKey: Partial<Record<keyof ScenarioAssumptionsOverride, string>>;
    patchItemLookup: Map<string, PatchItemMeta>;
  }
): ExperimentTarget[] => {
  const targets: ExperimentTarget[] = [];
  const seen = new Set<string>();

  const push = (target: ExperimentTarget) => {
    const key =
      target.kind === "assumption"
        ? `assumption:${target.key}`
        : `${target.kind}:${target.id}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    targets.push(target);
  };

  if (group.target?.baselineEventId) {
    const eventId = group.target.baselineEventId;
    const label = baselineState.eventLabelById.get(eventId) ?? eventId;
    push({ kind: "event", id: eventId, label, locateId: `event:${eventId}` });
  }

  const bundleId = group.target?.bundleId ?? group.bundleInstanceId;
  if (bundleId) {
    const label = baselineState.bundleLabelById.get(bundleId) ?? bundleId;
    push({ kind: "bundle", id: bundleId, label, locateId: `bundle:${bundleId}` });
  }

  const assumptionKeys = new Set<string>();
  if (group.target?.envKey) {
    assumptionKeys.add(group.target.envKey);
  }
  if (group.kind === "ENV_OVERRIDE") {
    (Object.keys(group.envOverrides ?? {}) as Array<keyof ScenarioAssumptionsOverride>).forEach((key) => {
      assumptionKeys.add(key);
    });
  }

  assumptionKeys.forEach((key) => {
    const label =
      baselineState.assumptionLabelByKey[key as keyof ScenarioAssumptionsOverride] ?? key;
    push({ kind: "assumption", key, label });
  });

  const activeItemIds = group.itemIds.filter(
    (itemId) => !(group.removedItems ?? []).some((item) => item.itemId === itemId)
  );

  const sourceItemIds =
    group.affectedEntities && group.affectedEntities.length > 0
      ? group.affectedEntities.map((entity) => entity.itemId)
      : activeItemIds;

  sourceItemIds.forEach((rawItemId) => {
    const itemId = normalizeItemId(rawItemId);
    if (itemId.startsWith("event:")) {
      const eventId = itemId.replace("event:", "");
      const patchLabel = baselineState.patchItemLookup.get(rawItemId)?.label;
      const label = baselineState.eventLabelById.get(eventId) ?? patchLabel?.trim() ?? eventId;
      push({ kind: "event", id: eventId, label, locateId: `event:${eventId}` });
      return;
    }
    if (itemId.startsWith("bundle:")) {
      const id = itemId.replace("bundle:", "");
      const label = baselineState.bundleLabelById.get(id) ?? id;
      push({ kind: "bundle", id, label, locateId: `bundle:${id}` });
      return;
    }
    if (group.kind === "ENV_OVERRIDE") {
      const assumptionKey = rawItemId as keyof ScenarioAssumptionsOverride;
      const label = baselineState.assumptionLabelByKey[assumptionKey] ?? rawItemId;
      push({ kind: "assumption", key: rawItemId, label });
    }
  });

  return targets;
};
