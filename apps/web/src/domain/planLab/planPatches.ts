import type { EventDefinition, ScenarioEventRef } from "../events/types";
import type {
  BudgetRule,
  Scenario,
  ScenarioMember,
  ScenarioPositions,
} from "../../store/scenarioStore";
import type { PlanLabDraft, PlanPatch, PlanLabDraftAdditions } from "./types";
import { WarningCode, type CompilerWarning } from "../warnings/types";

type PlanPatchWarning = CompilerWarning & { patch?: PlanPatch };

const cloneValue = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const positionIds = (positions?: ScenarioPositions) => {
  const homes =
    positions?.homes?.map((item) => ({ id: item.id, kind: "asset" as const })) ??
    [];
  const cars =
    positions?.cars?.map((item) => ({ id: item.id, kind: "asset" as const })) ?? [];
  const investments =
    positions?.investments?.map((item) => ({ id: item.id, kind: "asset" as const })) ??
    [];
  const insurances =
    positions?.insurances?.map((item) => ({ id: item.id, kind: "asset" as const })) ??
    [];
  const loans =
    positions?.loans?.map((item) => ({ id: item.id, kind: "liability" as const })) ??
    [];
  const cashBuckets =
    positions?.cashBuckets?.map((item) => ({ id: item.id, kind: "asset" as const })) ??
    [];
  return [...homes, ...cars, ...investments, ...insurances, ...loans, ...cashBuckets];
};

const detectPositionEntity = (
  scenario: Scenario,
  id: string | undefined
): "asset" | "liability" => {
  if (!id) {
    return "asset" as const;
  }
  const match = positionIds(scenario.positions).find((entry) => entry.id === id);
  return match?.kind ?? "asset";
};

const buildScenarioLookup = (
  scenario: Scenario,
  budgetRules: BudgetRule[],
  members: ScenarioMember[]
) => ({
  eventRefIds: new Set((scenario.eventRefs ?? []).map((ref) => ref.refId)),
  budgetRuleIds: new Set(budgetRules.map((rule) => rule.id)),
  memberIds: new Set(members.map((member) => member.id)),
  positionIds: new Set(positionIds(scenario.positions).map((entry) => entry.id)),
});

const parseScorecardPatch = (patch: PlanPatch, draft: PlanLabDraft) => {
  if (patch.path !== "scorecardSettings") {
    return;
  }
  if (patch.op !== "set") {
    return;
  }
  if (!patch.value || typeof patch.value !== "object") {
    return;
  }
  const value = patch.value as { firstBucketTargetAmount?: number };
  draft.scorecardSettings = {
    ...(draft.scorecardSettings ?? {}),
    firstBucketTargetAmount: value.firstBucketTargetAmount,
  };
};

export const buildPlanPatchesFromDraft = (
  draft: PlanLabDraft,
  scenario: Scenario
): PlanPatch[] => {
  const patches: PlanPatch[] = [];
  const baseline = draft.baselinePatches ?? {};

  Object.entries(baseline.eventPatches ?? {}).forEach(([id, patch]) => {
    patches.push({
      op: "set",
      entity: "event",
      id,
      value: cloneValue(patch),
    });
  });

  Object.entries(baseline.rulePatches ?? {}).forEach(([id, patch]) => {
    patches.push({
      op: "set",
      entity: "rule",
      id,
      value: cloneValue(patch),
    });
  });

  Object.entries(baseline.positionPatches ?? {}).forEach(([id, patch]) => {
    patches.push({
      op: "set",
      entity: detectPositionEntity(scenario, id),
      id,
      value: cloneValue(patch),
    });
  });

  if (baseline.smartInvestPatch) {
    patches.push({
      op: "set",
      entity: "moneyItem",
      id: "smartInvest",
      path: "assumptions.smartInvest",
      value: cloneValue(baseline.smartInvestPatch),
    });
  }

  (draft.experiments ?? []).forEach((experiment) => {
    patches.push({
      op: "add",
      entity: "event",
      id: experiment.id,
      value: { kind: "experiment", experiment: cloneValue(experiment) },
    });
  });

  const additions = draft.additions ?? {};
  (additions.members ?? []).forEach((member) => {
    patches.push({
      op: "add",
      entity: "member",
      id: member.id,
      value: cloneValue(member),
    });
  });
  (additions.budgetRules ?? []).forEach((rule) => {
    patches.push({
      op: "add",
      entity: "rule",
      id: rule.id,
      value: cloneValue(rule),
    });
  });
  (additions.events ?? []).forEach((event) => {
    patches.push({
      op: "add",
      entity: "event",
      id: event.definition.id,
      value: {
        kind: "definition",
        definition: cloneValue(event.definition),
        ref: cloneValue(event.ref),
      },
    });
  });

  if (draft.scorecardSettings?.firstBucketTargetAmount !== undefined) {
    patches.push({
      op: "set",
      entity: "moneyItem",
      id: "scorecardSettings",
      path: "scorecardSettings",
      value: {
        firstBucketTargetAmount: draft.scorecardSettings.firstBucketTargetAmount,
      },
    });
  }

  return patches;
};

export const buildPlanLabDraftFromPatches = (patches: PlanPatch[]): PlanLabDraft => {
  type ExperimentEntry = NonNullable<PlanLabDraft["experiments"]>[number];
  const draft: PlanLabDraft = {
    baselinePatches: {
      eventPatches: {},
      rulePatches: {},
      positionPatches: {},
    },
    experiments: [],
    additions: {},
  };

  const additions: PlanLabDraftAdditions = {
    members: [],
    budgetRules: [],
    events: [],
  };

  patches.forEach((patch) => {
    if (patch.entity === "moneyItem") {
      parseScorecardPatch(patch, draft);
    }
    if (patch.entity === "event" && patch.op === "add") {
      const value = patch.value as
        | { kind: "experiment"; experiment: ExperimentEntry }
        | { kind: "definition"; definition: EventDefinition; ref: ScenarioEventRef }
        | undefined;
      if (value?.kind === "experiment") {
        draft.experiments?.push(value.experiment);
      } else if (value?.kind === "definition" && value.definition && value.ref) {
        additions.events?.push({ definition: value.definition, ref: value.ref });
      }
      return;
    }
    if (patch.entity === "member" && patch.op === "add" && patch.value) {
      additions.members?.push(patch.value as ScenarioMember);
      return;
    }
    if (patch.entity === "rule" && patch.op === "add" && patch.value) {
      additions.budgetRules?.push(patch.value as BudgetRule);
      return;
    }

    if (patch.op === "set" || patch.op === "remove") {
      if (patch.entity === "event" && patch.id) {
        const value = patch.value as PlanLabDraft["baselinePatches"] extends {
          eventPatches?: Record<string, infer T>;
        }
          ? T
          : unknown;
        draft.baselinePatches = draft.baselinePatches ?? {};
        draft.baselinePatches.eventPatches = draft.baselinePatches.eventPatches ?? {};
        draft.baselinePatches.eventPatches[patch.id] =
          patch.op === "remove"
            ? { isDisabled: true }
            : (value as Record<string, unknown>);
        return;
      }
      if (patch.entity === "rule" && patch.id) {
        const value = patch.value as PlanLabDraft["baselinePatches"] extends {
          rulePatches?: Record<string, infer T>;
        }
          ? T
          : unknown;
        draft.baselinePatches = draft.baselinePatches ?? {};
        draft.baselinePatches.rulePatches = draft.baselinePatches.rulePatches ?? {};
        draft.baselinePatches.rulePatches[patch.id] =
          patch.op === "remove"
            ? { isDisabled: true }
            : (value as Record<string, unknown>);
        return;
      }
      if ((patch.entity === "asset" || patch.entity === "liability") && patch.id) {
        const value = patch.value as PlanLabDraft["baselinePatches"] extends {
          positionPatches?: Record<string, infer T>;
        }
          ? T
          : unknown;
        draft.baselinePatches = draft.baselinePatches ?? {};
        draft.baselinePatches.positionPatches =
          draft.baselinePatches.positionPatches ?? {};
        draft.baselinePatches.positionPatches[patch.id] =
          patch.op === "remove"
            ? { isDisabled: true }
            : (value as Record<string, unknown>);
        return;
      }
      if (patch.entity === "moneyItem" && patch.id === "smartInvest") {
        draft.baselinePatches = draft.baselinePatches ?? {};
        draft.baselinePatches.smartInvestPatch =
          patch.value as PlanLabDraft["baselinePatches"] extends {
            smartInvestPatch?: infer T;
          }
            ? T
            : undefined;
      }
    }
  });

  if (
    additions.members?.length ||
    additions.budgetRules?.length ||
    additions.events?.length
  ) {
    draft.additions = additions;
  }

  return draft;
};

export const validatePlanPatches = (
  patches: PlanPatch[],
  scenario: Scenario,
  budgetRules: BudgetRule[],
  members: ScenarioMember[]
): PlanPatchWarning[] => {
  const warnings: PlanPatchWarning[] = [];
  const lookup = buildScenarioLookup(scenario, budgetRules, members);

  patches.forEach((patch) => {
    if (patch.path && patch.entity === "moneyItem") {
      const allowedPaths = new Set(["assumptions.smartInvest", "scorecardSettings"]);
      if (!allowedPaths.has(patch.path)) {
        warnings.push({
          code: WarningCode.PlanInvalidPatch,
          severity: "warning",
          messageKey: "planLabInvalidPatch",
          defaultMessage: "Plan contains an invalid change.",
          patch,
        });
      }
    }
    if (patch.op === "add") {
      if ((patch.entity === "asset" || patch.entity === "liability") && patch.value) {
        warnings.push({
          code: WarningCode.PlanInvalidPatch,
          severity: "warning",
          messageKey: "planLabInvalidPatch",
          defaultMessage: "Plan contains an invalid change.",
          patch,
        });
      }
      return;
    }

    if (patch.op === "set" || patch.op === "remove") {
      if (patch.entity === "event" && patch.id && !lookup.eventRefIds.has(patch.id)) {
        warnings.push({
          code: WarningCode.PlanInvalidPatch,
          severity: "warning",
          messageKey: "planLabInvalidPatch",
          defaultMessage: "Plan contains an invalid change.",
          patch,
        });
      }
      if (patch.entity === "rule" && patch.id && !lookup.budgetRuleIds.has(patch.id)) {
        warnings.push({
          code: WarningCode.PlanInvalidPatch,
          severity: "warning",
          messageKey: "planLabInvalidPatch",
          defaultMessage: "Plan contains an invalid change.",
          patch,
        });
      }
      if (
        (patch.entity === "asset" || patch.entity === "liability") &&
        patch.id &&
        !lookup.positionIds.has(patch.id)
      ) {
        warnings.push({
          code: WarningCode.PlanInvalidPatch,
          severity: "warning",
          messageKey: "planLabInvalidPatch",
          defaultMessage: "Plan contains an invalid change.",
          patch,
        });
      }
      if (patch.entity === "member" && patch.id && !lookup.memberIds.has(patch.id)) {
        warnings.push({
          code: WarningCode.PlanInvalidPatch,
          severity: "warning",
          messageKey: "planLabInvalidPatch",
          defaultMessage: "Plan contains an invalid change.",
          patch,
        });
      }
    }
  });

  const hasAddedEvents = patches.some(
    (patch) => patch.entity === "event" && patch.op === "add"
  );
  const hasAddedPositions = patches.some(
    (patch) =>
      (patch.entity === "asset" || patch.entity === "liability") && patch.op === "add"
  );
  const hasAddedMoneyItems = patches.some(
    (patch) => patch.entity === "moneyItem" && patch.op === "add"
  );
  if (hasAddedEvents && (hasAddedPositions || hasAddedMoneyItems)) {
    warnings.push({
      code: WarningCode.PlanDoubleCounting,
      severity: "warning",
      messageKey: "planLabDoubleCountingWarning",
      defaultMessage:
        "Potential double counting: the plan adds both events and positions.",
    });
  }

  return warnings;
};
