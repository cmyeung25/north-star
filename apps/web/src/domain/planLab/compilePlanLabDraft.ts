import type { EventDefinition, EventRule, ScenarioEventRef } from "../events/types";
import type {
  BudgetRule,
  Scenario,
  ScenarioAssumptions,
  ScenarioMember,
  ScenarioPositions,
} from "../../store/scenarioStore";
import type {
  PlanLabDraft,
  PlanLabEventPatch,
  PlanLabPositionPatch,
  PlanLabRulePatch,
} from "./types";
import { compilePlanLabExtras } from "./compilePlanLabExtras";
import {
  normalizeDraftMonth,
  type PlanLabDraftWarning,
} from "./compileUtils";
import { buildScenarioEventViews } from "../events/utils";
import { WarningCode } from "../warnings/types";
import { buildSmartInvestPolicyFromDraft } from "./smartInvestAdjust";
import { appliesToScenario } from "../applyScope";

export type PlanLabDraftCompilation = {
  assumptions: Partial<ScenarioAssumptions>;
  positions: Partial<ScenarioPositions>;
  eventDefinitions: EventDefinition[];
  eventRefs: ScenarioEventRef[];
  eventRefOverrides: ScenarioEventRef[];
  members: ScenarioMember[];
  budgetRules?: BudgetRule[];
  warnings: PlanLabDraftWarning[];
};

type CompilePlanLabDraftOptions = {
  baselineScenario?: Scenario | null;
  eventLibrary?: EventDefinition[];
  budgetRules?: BudgetRule[];
  members?: ScenarioMember[];
};

const housingKeywords = ["mortgage", "housing", "home", "rent"];

const buildEventPatchDefinition = (
  definition: EventDefinition,
  patch: PlanLabEventPatch,
  warnings: PlanLabDraftWarning[]
) => {
  if (!patch.patch) {
    return null;
  }
  const nextRulePatch: Partial<EventRule> = patch.patch.rule ?? {};
  const nextRule = {
    ...definition.rule,
    ...nextRulePatch,
  };
  if (nextRulePatch.startMonth) {
    const startMonth = normalizeDraftMonth(
      `baselinePatches.events.${definition.id}.startMonth`,
      nextRulePatch.startMonth,
      warnings,
      { refId: definition.id }
    );
    if (startMonth) {
      nextRule.startMonth = startMonth;
    }
  }
  if (nextRulePatch.endMonth) {
    const endMonth = normalizeDraftMonth(
      `baselinePatches.events.${definition.id}.endMonth`,
      nextRulePatch.endMonth,
      warnings,
      { refId: definition.id }
    );
    if (endMonth) {
      nextRule.endMonth = endMonth;
    }
  }
  return {
    ...definition,
    ...patch.patch,
    rule: nextRule,
  };
};

const mergeEventOverrides = (
  overridesById: Map<string, ScenarioEventRef>,
  refId: string,
  patch: PlanLabEventPatch,
  warnings: PlanLabDraftWarning[]
) => {
  const existing = overridesById.get(refId);
  const nextOverride: ScenarioEventRef = existing ?? {
    refId,
    enabled: true,
    overrides: {},
  };
  if (patch.isDisabled !== undefined) {
    nextOverride.enabled = !patch.isDisabled;
  }
  if (patch.endMonth) {
    const endMonth = normalizeDraftMonth(
      `baselinePatches.events.${refId}.endMonth`,
      patch.endMonth,
      warnings,
      { refId }
    );
    if (endMonth) {
      nextOverride.overrides = {
        ...(nextOverride.overrides ?? {}),
        endMonth,
      };
    }
  }
  overridesById.set(refId, nextOverride);
};

const applyRulePatch = (
  rule: BudgetRule,
  patch: PlanLabRulePatch,
  warnings: PlanLabDraftWarning[]
) => {
  const nextPatch = patch.patch ?? {};
  const nextRule: BudgetRule = {
    ...rule,
    ...nextPatch,
  };
  if (nextPatch.startMonth) {
    const startMonth = normalizeDraftMonth(
      `baselinePatches.rules.${rule.id}.startMonth`,
      nextPatch.startMonth,
      warnings,
      { ruleId: rule.id }
    );
    if (startMonth) {
      nextRule.startMonth = startMonth;
    }
  }
  if (nextPatch.endMonth) {
    const endMonth = normalizeDraftMonth(
      `baselinePatches.rules.${rule.id}.endMonth`,
      nextPatch.endMonth,
      warnings,
      { ruleId: rule.id }
    );
    if (endMonth) {
      nextRule.endMonth = endMonth;
    }
  }
  if (patch.endMonth) {
    const endMonth = normalizeDraftMonth(
      `baselinePatches.rules.${rule.id}.endMonth`,
      patch.endMonth,
      warnings,
      { ruleId: rule.id }
    );
    if (endMonth) {
      nextRule.endMonth = endMonth;
    }
  }
  if (patch.isDisabled !== undefined) {
    nextRule.enabled = !patch.isDisabled;
  }
  return nextRule;
};

const applyPositionPatch = <T extends object>(
  position: T,
  patch?: PlanLabPositionPatch
): T | null => {
  if (!patch) {
    return position;
  }
  if (patch.isDisabled) {
    return null;
  }
  if (!patch.patch) {
    return position;
  }
  return {
    ...position,
    ...patch.patch,
  };
};

export const compilePlanLabDraft = (
  draft?: PlanLabDraft | null,
  options: CompilePlanLabDraftOptions = {}
): PlanLabDraftCompilation => {
  if (!draft) {
    const scenarioId = options.baselineScenario?.id;
    const combinedMembers = options.members ?? [];
    const scopedMembers = scenarioId
      ? combinedMembers.filter((member) => appliesToScenario(member.applyScope, scenarioId))
      : combinedMembers;
    return {
      assumptions: {},
      positions: {},
      eventDefinitions: [],
      eventRefs: [],
      eventRefOverrides: [],
      members: scopedMembers,
      warnings: [],
    };
  }

  const warnings: PlanLabDraftWarning[] = [];
  const assumptions: Partial<ScenarioAssumptions> = {};
  const positions: Partial<ScenarioPositions> = {};
  const eventDefinitions: EventDefinition[] = [];
  const eventRefs: ScenarioEventRef[] = [];
  const eventRefOverrides: ScenarioEventRef[] = [];
  const baselineScenario = options.baselineScenario ?? null;
  const eventLibrary = options.eventLibrary ?? [];
  const budgetRules = options.budgetRules ?? [];
  const members = options.members ?? [];
  const baselinePatches = draft.baselinePatches ?? {};
  const eventPatches = baselinePatches.eventPatches ?? {};
  const rulePatches = baselinePatches.rulePatches ?? {};
  const positionPatches = baselinePatches.positionPatches ?? {};
  const smartInvestPatch = baselinePatches.smartInvestPatch;
  const experiments = draft.experiments ?? [];
  const additions = draft.additions ?? {};
  const draftMembers = additions.members ?? [];
  const draftBudgetRules = additions.budgetRules ?? [];
  const draftEvents = additions.events ?? [];
  const scenarioId = baselineScenario?.id;

  const normalizeMember = (member: ScenarioMember): ScenarioMember => {
    if (!member.birthMonth) {
      return member;
    }
    const normalizedBirthMonth = normalizeDraftMonth(
      `members.${member.id}.birthMonth`,
      member.birthMonth,
      warnings,
      { memberId: member.id }
    );
    return {
      ...member,
      birthMonth: normalizedBirthMonth ?? undefined,
    };
  };

  const combinedMembers = [...members, ...draftMembers];
  const scopedMembers = scenarioId
    ? combinedMembers.filter((member) => appliesToScenario(member.applyScope, scenarioId))
    : combinedMembers;
  const normalizedMembers = scopedMembers.map((member) => normalizeMember(member));

  if (baselineScenario) {
    const eventViews = buildScenarioEventViews(baselineScenario, eventLibrary);
    const overridesById = new Map<string, ScenarioEventRef>();
    eventViews.forEach((view) => {
      const patch = eventPatches[view.definition.id];
      if (!patch) {
        return;
      }
      const patchedDefinition = buildEventPatchDefinition(
        view.definition,
        patch,
        warnings
      );
      if (patchedDefinition) {
        eventDefinitions.push(patchedDefinition);
      }
      mergeEventOverrides(overridesById, view.ref.refId, patch, warnings);
    });
    eventRefOverrides.push(...overridesById.values());
  }

  const nextBudgetRules = budgetRules.map((rule) => {
    const patch = rulePatches[rule.id];
    if (!patch) {
      return rule;
    }
    return applyRulePatch(rule, patch, warnings);
  });

  const combinedBudgetRules = [...nextBudgetRules, ...draftBudgetRules];
  const scopedBudgetRules = scenarioId
    ? combinedBudgetRules.filter((rule) => appliesToScenario(rule.applyScope, scenarioId))
    : combinedBudgetRules;
  const patchedBudgetRules = scopedBudgetRules.filter((rule) => rule.enabled !== false);

  const normalizeEventRuleOverrides = (
    ref: ScenarioEventRef,
    definitionId: string
  ): ScenarioEventRef => {
    if (!ref.overrides) {
      return ref;
    }
    const overrides = { ...ref.overrides };
    if (overrides.startMonth) {
      const startMonth = normalizeDraftMonth(
        `additions.events.${definitionId}.overrides.startMonth`,
        overrides.startMonth,
        warnings,
        { refId: definitionId }
      );
      if (startMonth) {
        overrides.startMonth = startMonth;
      } else {
        delete overrides.startMonth;
      }
    }
    if (overrides.endMonth) {
      const endMonth = normalizeDraftMonth(
        `additions.events.${definitionId}.overrides.endMonth`,
        overrides.endMonth,
        warnings,
        { refId: definitionId }
      );
      if (endMonth) {
        overrides.endMonth = endMonth;
      } else {
        delete overrides.endMonth;
      }
    }
    if (overrides.schedule) {
      const normalizedSchedule = overrides.schedule
        .map((entry, index) => {
          const month = normalizeDraftMonth(
            `additions.events.${definitionId}.overrides.schedule.${index}.month`,
            entry.month,
            warnings,
            { refId: definitionId }
          );
          if (!month) {
            return null;
          }
          return { ...entry, month };
        })
        .filter(Boolean) as typeof overrides.schedule;
      overrides.schedule = normalizedSchedule.length > 0 ? normalizedSchedule : undefined;
    }
    return {
      ...ref,
      overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    };
  };

  const normalizeEventDefinition = (
    addition: (typeof draftEvents)[number]
  ): { definition: EventDefinition; ref: ScenarioEventRef } | null => {
    const { definition, ref } = addition;
    const nextRule = { ...definition.rule };
    if (nextRule.startMonth) {
      const startMonth = normalizeDraftMonth(
        `additions.events.${definition.id}.startMonth`,
        nextRule.startMonth,
        warnings,
        { refId: definition.id }
      );
      if (startMonth) {
        nextRule.startMonth = startMonth;
      } else {
        return null;
      }
    }
    if (nextRule.endMonth) {
      const endMonth = normalizeDraftMonth(
        `additions.events.${definition.id}.endMonth`,
        nextRule.endMonth,
        warnings,
        { refId: definition.id }
      );
      if (endMonth) {
        nextRule.endMonth = endMonth;
      } else {
        nextRule.endMonth = null;
      }
    }
    if (nextRule.schedule) {
      const normalizedSchedule = nextRule.schedule
        .map((entry, index) => {
          const month = normalizeDraftMonth(
            `additions.events.${definition.id}.schedule.${index}.month`,
            entry.month,
            warnings,
            { refId: definition.id }
          );
          if (!month) {
            return null;
          }
          return { ...entry, month };
        })
        .filter(Boolean) as typeof nextRule.schedule;
      nextRule.schedule = normalizedSchedule.length > 0 ? normalizedSchedule : undefined;
    }
    return {
      definition: {
        ...definition,
        rule: nextRule,
      },
      ref: normalizeEventRuleOverrides(
        {
          ...ref,
          refId: definition.id,
        },
        definition.id
      ),
    };
  };

  const nextPositions: Partial<ScenarioPositions> = {};
  const smartInvestPolicy = buildSmartInvestPolicyFromDraft({
    baselinePolicy: baselineScenario?.assumptions.smartInvest,
    baselinePatch: smartInvestPatch,
    experiments,
  });
  if (smartInvestPolicy) {
    assumptions.smartInvest = smartInvestPolicy;
  }
  if (baselineScenario?.positions) {
    const positionsSource = baselineScenario.positions;
    if (positionsSource.home) {
      const patchedHome = applyPositionPatch(
        positionsSource.home,
        positionPatches["home:primary"]
      );
      if (patchedHome) {
        nextPositions.home = patchedHome;
      } else {
        nextPositions.home = undefined;
      }
    }
    if (positionsSource.homes) {
      const nextHomes = positionsSource.homes
        .map((home, index) =>
          applyPositionPatch(
            home,
            positionPatches[`home:${home.id ?? `index-${index}`}`]
          )
        )
        .filter(Boolean) as typeof positionsSource.homes;
      nextPositions.homes = nextHomes;
    }
    if (positionsSource.cars) {
      const nextCars = positionsSource.cars
        .map((car, index) =>
          applyPositionPatch(
            car,
            positionPatches[`car:${car.id ?? `index-${index}`}`]
          )
        )
        .filter(Boolean) as typeof positionsSource.cars;
      nextPositions.cars = nextCars;
    }
    if (positionsSource.investments) {
      const nextInvestments = positionsSource.investments
        .map((investment, index) =>
          applyPositionPatch(
            investment,
            positionPatches[`investment:${investment.id ?? `index-${index}`}`]
          )
        )
        .filter(Boolean) as typeof positionsSource.investments;
      nextPositions.investments = nextInvestments;
    }
    if (positionsSource.insurances) {
      const nextInsurances = positionsSource.insurances
        .map((insurance, index) =>
          applyPositionPatch(
            insurance,
            positionPatches[`insurance:${insurance.id ?? `index-${index}`}`]
          )
        )
        .filter(Boolean) as typeof positionsSource.insurances;
      nextPositions.insurances = nextInsurances;
    }
    if (positionsSource.loans) {
      const nextLoans = positionsSource.loans
        .map((loan, index) =>
          applyPositionPatch(
            loan,
            positionPatches[`loan:${loan.id ?? `index-${index}`}`]
          )
        )
        .filter(Boolean) as typeof positionsSource.loans;
      nextPositions.loans = nextLoans;
    }
    if (positionsSource.cashBuckets) {
      const nextBuckets = positionsSource.cashBuckets
        .map((bucket, index) =>
          applyPositionPatch(
            bucket,
            positionPatches[`cash:${bucket.id ?? `index-${index}`}`]
          )
        )
        .filter(Boolean) as typeof positionsSource.cashBuckets;
      nextPositions.cashBuckets = nextBuckets;
    }
  }

  const extras = compilePlanLabExtras(draft, {
    baselineScenario,
  });
  warnings.push(...extras.warnings);
  eventDefinitions.push(...extras.eventDefinitions);
  eventRefs.push(...extras.eventRefs);
  draftEvents.forEach((addition) => {
    const normalized = normalizeEventDefinition(addition);
    if (!normalized) {
      return;
    }
    eventDefinitions.push(normalized.definition);
    eventRefs.push(normalized.ref);
  });
  Object.assign(positions, nextPositions);

  if (extras.positions.homes) {
    positions.homes = [
      ...(positions.homes ?? []),
      ...extras.positions.homes,
    ];
  }
  if (extras.positions.cars) {
    positions.cars = [
      ...(positions.cars ?? []),
      ...extras.positions.cars,
    ];
  }

  if (baselineScenario) {
    const combinedEventLibrary = [
      ...eventLibrary,
      ...eventDefinitions,
    ];
    const baselineEventRefs = baselineScenario.eventRefs?.map((ref) => {
      const override = eventRefOverrides.find(
        (candidate) => candidate.refId === ref.refId
      );
      return override
        ? {
            ...ref,
            enabled: override.enabled ?? ref.enabled,
            overrides: {
              ...(ref.overrides ?? {}),
              ...(override.overrides ?? {}),
            },
          }
        : ref;
    }) ?? [];
    const eventViews = buildScenarioEventViews(
      {
        ...baselineScenario,
        eventRefs: [...baselineEventRefs, ...eventRefs],
      },
      combinedEventLibrary
    );
    const hasHomePositions =
      Boolean(positions.home) || (positions.homes?.length ?? 0) > 0;
    const hasHousingEvents = eventViews.some((view) => {
      if (!view.ref.enabled) {
        return false;
      }
      if (view.definition.type === "buy_home") {
        return true;
      }
      const title = view.definition.title.toLowerCase();
      return housingKeywords.some((keyword) => title.includes(keyword));
    });
    if (hasHomePositions && hasHousingEvents) {
      warnings.push({
        code: WarningCode.DoubleCountingHomeEvent,
        severity: "warning",
        messageKey: "warnings.doubleCountingHomeRent",
        defaultMessage:
          "Home positions and housing-related events are both active; double counting may occur.",
        refs: { scenarioId: baselineScenario.id },
      });
    }
  }

  return {
    assumptions,
    positions,
    eventDefinitions,
    eventRefs,
    eventRefOverrides,
    members: normalizedMembers,
    budgetRules: patchedBudgetRules,
    warnings,
  };
};
