import type { EventDefinition, ScenarioEventRef } from "../events/types";
import type { BudgetRule, Scenario, ScenarioPositions } from "../../store/scenarioStore";
import { normalizeMonthStrict } from "../../utils/month";
import type { PlanLabDraft } from "./types";
import { compilePlanLabExtras } from "./compilePlanLabExtras";
import { buildSmartInvestPolicyFromDraft } from "./smartInvestAdjust";

export type PlanLabScenarioApplyWarning = {
  code: "replace-homes";
  message: string;
};

export type PlanLabScenarioApplyError = {
  code: "invalid-month" | "missing-month";
  field: string;
  message: string;
};

export type PlanLabScenarioApplyResult = {
  scenario: Scenario;
  eventDefinitions: EventDefinition[];
  budgetRules?: BudgetRule[];
  warnings: PlanLabScenarioApplyWarning[];
  errors: PlanLabScenarioApplyError[];
};

const normalizeOptionalMonth = (
  field: string,
  value: string | null | undefined,
  errors: PlanLabScenarioApplyError[]
): string | null => {
  if (!value) {
    return null;
  }
  const normalized = normalizeMonthStrict(value);
  if (!normalized.ok) {
    errors.push({
      code: "invalid-month",
      field,
      message: `${field} has invalid month ${value}.`,
    });
    return null;
  }
  return normalized.month;
};

export const applyPlanLabDraftToScenario = (
  baseScenario: Scenario,
  draft: PlanLabDraft,
  options: { scenarioId: string; budgetRules?: BudgetRule[] }
): PlanLabScenarioApplyResult => {
  const errors: PlanLabScenarioApplyError[] = [];
  const warnings: PlanLabScenarioApplyWarning[] = [];
  const eventDefinitions: EventDefinition[] = [];
  const planLabEventRefs: ScenarioEventRef[] = [];

  let nextPositions: ScenarioPositions | undefined = baseScenario.positions
    ? { ...baseScenario.positions }
    : undefined;
  const nextAssumptions = { ...baseScenario.assumptions };
  let nextEventRefs = baseScenario.eventRefs ?? [];
  const baselinePatches = draft.baselinePatches ?? {};
  const eventPatches = baselinePatches.eventPatches ?? {};
  const rulePatches = baselinePatches.rulePatches ?? {};
  const positionPatches = baselinePatches.positionPatches ?? {};
  const smartInvestPatch = baselinePatches.smartInvestPatch;
  const experiments = draft.experiments ?? [];
  const smartInvestPolicy = buildSmartInvestPolicyFromDraft({
    baselinePolicy: baseScenario.assumptions.smartInvest,
    baselinePatch: smartInvestPatch,
    experiments,
  });
  if (smartInvestPolicy) {
    nextAssumptions.smartInvest = smartInvestPolicy;
  }

  nextEventRefs = nextEventRefs.map((ref) => {
    const patch = eventPatches[ref.refId];
    if (!patch) {
      return ref;
    }
    const nextRef: ScenarioEventRef = {
      ...ref,
      enabled: patch.isDisabled !== undefined ? !patch.isDisabled : ref.enabled,
    };
    if (patch.endMonth) {
      const endMonth = normalizeOptionalMonth(
        `baselinePatches.events.${ref.refId}.endMonth`,
        patch.endMonth,
        errors
      );
      if (endMonth) {
        nextRef.overrides = {
          ...(nextRef.overrides ?? {}),
          endMonth,
        };
      }
    }
    return nextRef;
  });

  Object.entries(eventPatches).forEach(([refId, patch]) => {
    if (patch.patch) {
      eventDefinitions.push({
        ...patch.patch,
        id: patch.patch.id ?? refId,
      } as EventDefinition);
    }
  });

  experiments.forEach((experiment) => {
    if (experiment.isEnabled === false) {
      return;
    }
    if (experiment.type === "oneOffExpense") {
      normalizeOptionalMonth(`experiments.${experiment.id}.month`, experiment.month, errors);
    }
    if (experiment.type === "rangeExpense") {
      normalizeOptionalMonth(
        `experiments.${experiment.id}.startMonth`,
        experiment.startMonth,
        errors
      );
      normalizeOptionalMonth(
        `experiments.${experiment.id}.endMonth`,
        experiment.endMonth,
        errors
      );
    }
    if (experiment.type === "homeBuy") {
      normalizeOptionalMonth(
        `experiments.${experiment.id}.purchaseMonth`,
        experiment.purchaseMonth,
        errors
      );
    }
    if (experiment.type === "carPlan") {
      normalizeOptionalMonth(
        `experiments.${experiment.id}.purchaseMonth`,
        experiment.purchaseMonth,
        errors
      );
    }
    if (experiment.type === "incomeAdjust") {
      normalizeOptionalMonth(
        `experiments.${experiment.id}.startMonth`,
        experiment.startMonth,
        errors
      );
    }
    if (experiment.type === "travelAnnual") {
      normalizeOptionalMonth(
        `experiments.${experiment.id}.startMonth`,
        experiment.startMonth,
        errors
      );
    }
  });

  const nextBudgetRules = (options.budgetRules ?? []).map((rule) => {
    const patch = rulePatches[rule.id];
    if (!patch) {
      return rule;
    }
    const nextRule: BudgetRule = {
      ...rule,
      ...(patch.patch ?? {}),
    };
    if (patch.patch?.startMonth) {
      nextRule.startMonth = normalizeOptionalMonth(
        `baselinePatches.rules.${rule.id}.startMonth`,
        patch.patch.startMonth,
        errors
      ) ?? nextRule.startMonth;
    }
    if (patch.patch?.endMonth) {
      nextRule.endMonth = normalizeOptionalMonth(
        `baselinePatches.rules.${rule.id}.endMonth`,
        patch.patch.endMonth,
        errors
      ) ?? nextRule.endMonth;
    }
    if (patch.endMonth) {
      nextRule.endMonth = normalizeOptionalMonth(
        `baselinePatches.rules.${rule.id}.endMonth`,
        patch.endMonth,
        errors
      ) ?? nextRule.endMonth;
    }
    if (patch.isDisabled !== undefined) {
      nextRule.enabled = !patch.isDisabled;
    }
    return nextRule;
  });

  if (nextPositions) {
    if (nextPositions.home) {
      const patch = positionPatches["home:primary"];
      if (patch?.isDisabled) {
        nextPositions.home = undefined;
      } else if (patch?.patch) {
        nextPositions.home = {
          ...nextPositions.home,
          ...patch.patch,
        };
      }
    }
    if (nextPositions.homes) {
      nextPositions.homes = nextPositions.homes
        .map((home, index) => {
          const patch = positionPatches[`home:${home.id ?? `index-${index}`}`];
          if (patch?.isDisabled) {
            return null;
          }
          if (patch?.patch) {
            return {
              ...home,
              ...patch.patch,
            };
          }
          return home;
        })
        .filter(Boolean) as typeof nextPositions.homes;
    }
    if (nextPositions.cars) {
      nextPositions.cars = nextPositions.cars
        .map((car, index) => {
          const patch = positionPatches[`car:${car.id ?? `index-${index}`}`];
          if (patch?.isDisabled) {
            return null;
          }
          if (patch?.patch) {
            return {
              ...car,
              ...patch.patch,
            };
          }
          return car;
        })
        .filter(Boolean) as typeof nextPositions.cars;
    }
    if (nextPositions.investments) {
      nextPositions.investments = nextPositions.investments
        .map((investment, index) => {
          const patch = positionPatches[
            `investment:${investment.id ?? `index-${index}`}`
          ];
          if (patch?.isDisabled) {
            return null;
          }
          if (patch?.patch) {
            return {
              ...investment,
              ...patch.patch,
            };
          }
          return investment;
        })
        .filter(Boolean) as typeof nextPositions.investments;
    }
    if (nextPositions.insurances) {
      nextPositions.insurances = nextPositions.insurances
        .map((insurance, index) => {
          const patch = positionPatches[
            `insurance:${insurance.id ?? `index-${index}`}`
          ];
          if (patch?.isDisabled) {
            return null;
          }
          if (patch?.patch) {
            return {
              ...insurance,
              ...patch.patch,
            };
          }
          return insurance;
        })
        .filter(Boolean) as typeof nextPositions.insurances;
    }
    if (nextPositions.loans) {
      nextPositions.loans = nextPositions.loans
        .map((loan, index) => {
          const patch = positionPatches[`loan:${loan.id ?? `index-${index}`}`];
          if (patch?.isDisabled) {
            return null;
          }
          if (patch?.patch) {
            return {
              ...loan,
              ...patch.patch,
            };
          }
          return loan;
        })
        .filter(Boolean) as typeof nextPositions.loans;
    }
    if (nextPositions.cashBuckets) {
      nextPositions.cashBuckets = nextPositions.cashBuckets
        .map((bucket, index) => {
          const patch = positionPatches[`cash:${bucket.id ?? `index-${index}`}`];
          if (patch?.isDisabled) {
            return null;
          }
          if (patch?.patch) {
            return {
              ...bucket,
              ...patch.patch,
            };
          }
          return bucket;
        })
        .filter(Boolean) as typeof nextPositions.cashBuckets;
    }
  }

  const experimentExtras = compilePlanLabExtras(draft, {
    baselineScenario: baseScenario,
  });
  eventDefinitions.push(...experimentExtras.eventDefinitions);
  planLabEventRefs.push(...experimentExtras.eventRefs);

  if (experimentExtras.positions.homes) {
    nextPositions = {
      ...(nextPositions ?? {}),
      homes: [
        ...(nextPositions?.homes ?? []),
        ...experimentExtras.positions.homes,
      ],
    };
  }
  if (experimentExtras.positions.cars) {
    nextPositions = {
      ...(nextPositions ?? {}),
      cars: [
        ...(nextPositions?.cars ?? []),
        ...experimentExtras.positions.cars,
      ],
    };
  }

  if (errors.length > 0) {
    return {
      scenario: baseScenario,
      eventDefinitions: [],
      budgetRules: undefined,
      warnings,
      errors,
    };
  }

  nextEventRefs = [...nextEventRefs, ...planLabEventRefs];

  return {
    scenario: {
      ...baseScenario,
      positions: nextPositions,
      assumptions: nextAssumptions,
      eventRefs: nextEventRefs,
      updatedAt: Date.now(),
    },
    eventDefinitions,
    budgetRules: nextBudgetRules,
    warnings,
    errors,
  };
};
