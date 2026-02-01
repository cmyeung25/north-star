import type { ScenarioV2 } from "../../engine/scenarioV2Compiler";
import type { BudgetRule } from "../../store/scenarioStore";
import type {
  PlanLabEventsPatch,
  PlanLabRulesPatch,
  PlanLabSnapshotPayload,
} from "./types";
import type { ScenarioEvent } from "../scenarioV2/events";

const emptyEventsPatch: PlanLabEventsPatch = {
  add: [],
  update: [],
  remove: [],
};

const emptyRulesPatch: PlanLabRulesPatch = {
  add: [],
  update: [],
  remove: [],
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const hashString = (input: string) => {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const buildEventsPatch = (
  baseline: ScenarioEvent[],
  next: ScenarioEvent[]
): PlanLabEventsPatch => {
  const baselineMap = new Map(baseline.map((event) => [event.id, event]));
  const nextMap = new Map(next.map((event) => [event.id, event]));

  const add: ScenarioEvent[] = [];
  const update: Array<{ id: string; patch: Partial<ScenarioEvent> }> = [];
  const remove: string[] = [];

  next.forEach((event) => {
    if (!baselineMap.has(event.id)) {
      add.push(event);
    }
  });

  baseline.forEach((event) => {
    if (!nextMap.has(event.id)) {
      remove.push(event.id);
    }
  });

  next.forEach((event) => {
    const baselineEvent = baselineMap.get(event.id);
    if (!baselineEvent) {
      return;
    }
    if (stableStringify(baselineEvent) === stableStringify(event)) {
      return;
    }
    const patch: Partial<ScenarioEvent> = {};
    (Object.keys(event) as Array<keyof ScenarioEvent>).forEach((key) => {
      if (key === "id") {
        return;
      }
      if (stableStringify(event[key]) !== stableStringify(baselineEvent[key])) {
        patch[key] = event[key] as never;
      }
    });
    update.push({ id: event.id, patch });
  });

  return { add, update, remove };
};

const buildRulesPatch = (
  baseline: BudgetRule[],
  next: BudgetRule[]
): PlanLabRulesPatch => {
  const baselineMap = new Map(baseline.map((rule) => [rule.id, rule]));
  const nextMap = new Map(next.map((rule) => [rule.id, rule]));

  const add: BudgetRule[] = [];
  const update: Array<{ id: string; patch: Partial<BudgetRule> }> = [];
  const remove: string[] = [];

  next.forEach((rule) => {
    if (!baselineMap.has(rule.id)) {
      add.push(rule);
    }
  });

  baseline.forEach((rule) => {
    if (!nextMap.has(rule.id)) {
      remove.push(rule.id);
    }
  });

  next.forEach((rule) => {
    const baselineRule = baselineMap.get(rule.id);
    if (!baselineRule) {
      return;
    }
    if (stableStringify(baselineRule) === stableStringify(rule)) {
      return;
    }
    const patchData: Record<string, unknown> = {};
    (Object.keys(rule) as Array<keyof BudgetRule>).forEach((key) => {
      if (key === "id") {
        return;
      }
      if (stableStringify(rule[key]) !== stableStringify(baselineRule[key])) {
        patchData[key] = rule[key];
      }
    });
    update.push({ id: rule.id, patch: patchData as Partial<BudgetRule> });
  });

  return { add, update, remove };
};

export const buildSnapshotPayload = (
  baselineScenario: ScenarioV2,
  sandboxScenario: ScenarioV2,
  baselineRules: BudgetRule[] = [],
  sandboxRules: BudgetRule[] = []
): PlanLabSnapshotPayload => {
  return {
    eventsPatch: buildEventsPatch(
      baselineScenario.events ?? [],
      sandboxScenario.events ?? []
    ),
    rulesPatch: buildRulesPatch(baselineRules, sandboxRules),
  };
};

export const emptySnapshotPayload = (): PlanLabSnapshotPayload => ({
  eventsPatch: { ...emptyEventsPatch },
  rulesPatch: { ...emptyRulesPatch },
});

export const applyPatchToScenario = (
  baseline: ScenarioV2,
  payload: PlanLabSnapshotPayload
): ScenarioV2 => {
  const removeSet = new Set(payload.eventsPatch.remove);
  const updateMap = new Map(payload.eventsPatch.update.map((entry) => [entry.id, entry.patch]));

  const updatedEvents = (baseline.events ?? [])
    .filter((event) => !removeSet.has(event.id))
    .map((event) => {
      const patch = updateMap.get(event.id);
      if (!patch) {
        return event;
      }
      return { ...event, ...patch } as ScenarioEvent;
    });

  const additions = payload.eventsPatch.add.filter(
    (event) => !updatedEvents.some((existing) => existing.id === event.id)
  );

  return {
    ...baseline,
    events: [...updatedEvents, ...additions],
  };
};

export const applyPatchToRules = (
  baseline: BudgetRule[] = [],
  payload?: PlanLabRulesPatch
): BudgetRule[] => {
  if (!payload) {
    return baseline;
  }
  const removeSet = new Set(payload.remove);
  const updateMap = new Map(payload.update.map((entry) => [entry.id, entry.patch]));

  const updatedRules = baseline
    .filter((rule) => !removeSet.has(rule.id))
    .map((rule) => {
      const patch = updateMap.get(rule.id);
      if (!patch) {
        return rule;
      }
      return { ...rule, ...patch };
    });

  const additions = payload.add.filter(
    (rule) => !updatedRules.some((existing) => existing.id === rule.id)
  );

  return [...updatedRules, ...additions];
};

export const computeBaselineFingerprint = (
  scenario: ScenarioV2,
  budgetRules: BudgetRule[] = []
): string => {
  const normalized = {
    members: [...(scenario.members ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    assets: [...(scenario.assets ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    liabilities: [...(scenario.liabilities ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    events: [...(scenario.events ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    rules: [...budgetRules].sort((a, b) => a.id.localeCompare(b.id)),
  };
  return hashString(stableStringify(normalized));
};

export const hasMeaningfulPatch = (payload: PlanLabSnapshotPayload): boolean => {
  const eventsPatch = payload.eventsPatch;
  const rulesPatch = payload.rulesPatch;
  return (
    eventsPatch.add.length > 0 ||
    eventsPatch.update.length > 0 ||
    eventsPatch.remove.length > 0 ||
    (rulesPatch?.add.length ?? 0) > 0 ||
    (rulesPatch?.update.length ?? 0) > 0 ||
    (rulesPatch?.remove.length ?? 0) > 0
  );
};
