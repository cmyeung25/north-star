import { addMonths, monthIndex } from "@north-star/engine";
import type { EventDefinition, ScenarioEventRef } from "../events/types";
import type {
  CarPositionDraft,
  HomePositionDraft,
  Scenario,
  ScenarioPositions,
} from "../../store/scenarioStore";
import type {
  PlanLabBaselineEdit,
  PlanLabDraft,
  PlanLabExperiment,
} from "./types";
import {
  clampNonNegative,
  normalizeDraftMonth,
  toNumber,
  type PlanLabDraftWarning,
} from "./compileUtils";
import { buildScenarioEventViews } from "../events/utils";
import { WarningCode } from "../warnings/types";

type CompilePlanLabExtrasOptions = {
  baselineScenario?: Scenario | null;
  eventLibrary?: EventDefinition[];
};

type PlanLabExtrasCompilation = {
  positions: Partial<ScenarioPositions>;
  eventDefinitions: EventDefinition[];
  eventRefs: ScenarioEventRef[];
  eventRefOverrides: ScenarioEventRef[];
  warnings: PlanLabDraftWarning[];
};

const buildAnnualSchedule = (params: {
  startMonth: string;
  annualAmount: number;
  baseMonth?: string | null;
  horizonMonths?: number | null;
}) => {
  const schedule: Array<{ month: string; amount: number }> = [];
  if (!params.baseMonth || !params.horizonMonths) {
    return [{ month: params.startMonth, amount: params.annualAmount }];
  }

  let nextMonth = params.startMonth;
  let offset = monthIndex(params.baseMonth, nextMonth);
  while (offset < params.horizonMonths) {
    if (offset >= 0) {
      schedule.push({ month: nextMonth, amount: params.annualAmount });
    }
    nextMonth = addMonths(nextMonth, 12);
    offset = monthIndex(params.baseMonth, nextMonth);
  }
  return schedule;
};

const compileBaselineEdits = (
  edits: PlanLabBaselineEdit[],
  warnings: PlanLabDraftWarning[]
) =>
  edits.flatMap<ScenarioEventRef>((edit) => {
    if (edit.action === "keep" || edit.isEnabled === false) {
      return [];
    }
    if (edit.kind !== "rent" && edit.kind !== "car_running") {
      return [];
    }
    const endMonth = normalizeDraftMonth(
      `baselineEdits.${edit.id}.endMonth`,
      edit.endMonth,
      warnings,
      { refId: edit.refId, action: edit.action }
    );
    if (!endMonth) {
      return [];
    }
    return [
      {
        refId: edit.refId,
        enabled: true,
        overrides: { endMonth },
      },
    ];
  });

const compileExperimentToDefinition = (
  experiment: PlanLabExperiment,
  params: {
    warnings: PlanLabDraftWarning[];
    baselineScenario?: Scenario | null;
  }
) => {
  if (experiment.isEnabled === false) {
    return null;
  }

  if (experiment.type === "oneOffExpense") {
    const month = normalizeDraftMonth(
      `experiments.${experiment.id}.month`,
      experiment.month,
      params.warnings
    );
    const amount = clampNonNegative(toNumber(experiment.amount));
    if (!month || amount <= 0) {
      return null;
    }
    const definition: EventDefinition = {
      id: `plan-lab-exp-${experiment.id}`,
      title: "Plan Lab One-Off Expense",
      type: "custom",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth: month,
        endMonth: month,
        monthlyAmount: 0,
        oneTimeAmount: amount,
        annualGrowthPct: 0,
      },
    };
    return { definition };
  }

  if (experiment.type === "rangeExpense") {
    const startMonth = normalizeDraftMonth(
      `experiments.${experiment.id}.startMonth`,
      experiment.startMonth,
      params.warnings
    );
    const endMonth = normalizeDraftMonth(
      `experiments.${experiment.id}.endMonth`,
      experiment.endMonth,
      params.warnings
    );
    const amount = clampNonNegative(toNumber(experiment.monthlyAmount));
    if (!startMonth || !endMonth || amount <= 0) {
      return null;
    }
    const definition: EventDefinition = {
      id: `plan-lab-exp-${experiment.id}`,
      title: "Plan Lab Range Expense",
      type: "custom",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth,
        endMonth,
        monthlyAmount: amount,
        oneTimeAmount: 0,
        annualGrowthPct: 0,
      },
    };
    return { definition };
  }

  if (experiment.type === "incomeAdjust") {
    const startMonth = normalizeDraftMonth(
      `experiments.${experiment.id}.startMonth`,
      experiment.startMonth,
      params.warnings
    );
    const amount = clampNonNegative(toNumber(experiment.monthlyAmount));
    if (!startMonth || amount <= 0) {
      return null;
    }
    const definition: EventDefinition = {
      id: `plan-lab-exp-${experiment.id}`,
      title: "Plan Lab Income Adjustment",
      type: "salary",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth,
        endMonth: null,
        monthlyAmount: amount,
        oneTimeAmount: 0,
        annualGrowthPct: 0,
      },
    };
    return { definition };
  }

  if (experiment.type === "travelAnnual") {
    const startMonth = normalizeDraftMonth(
      `experiments.${experiment.id}.startMonth`,
      experiment.startMonth,
      params.warnings
    );
    const amount = clampNonNegative(toNumber(experiment.annualAmount));
    if (!startMonth || amount <= 0) {
      return null;
    }
    const baseMonth = params.baselineScenario?.assumptions.baseMonth ?? null;
    const horizonMonths = params.baselineScenario?.assumptions.horizonMonths ?? null;
    const schedule = buildAnnualSchedule({
      startMonth,
      annualAmount: amount,
      baseMonth,
      horizonMonths,
    });
    if (schedule.length === 0) {
      return null;
    }
    const definition: EventDefinition = {
      id: `plan-lab-exp-${experiment.id}`,
      title: "Plan Lab Annual Travel",
      type: "travel",
      kind: "cashflow",
      rule: {
        mode: "schedule",
        schedule,
      },
    };
    return { definition };
  }

  if (experiment.type === "homeBuy") {
    const purchaseMonth = normalizeDraftMonth(
      `experiments.${experiment.id}.purchaseMonth`,
      experiment.purchaseMonth,
      params.warnings
    );
    if (!purchaseMonth) {
      return null;
    }
    const purchasePrice = clampNonNegative(toNumber(experiment.purchasePrice));
    const downPaymentAmount =
      experiment.downPaymentAmount !== undefined
        ? clampNonNegative(toNumber(experiment.downPaymentAmount))
        : experiment.downPaymentPct !== undefined
          ? clampNonNegative(purchasePrice * (toNumber(experiment.downPaymentPct) / 100))
          : 0;
    const mortgageRatePct =
      experiment.mortgageRatePct ??
      params.baselineScenario?.assumptions.mortgageRatePct ??
      0;
    const termYears =
      experiment.termYears ??
      params.baselineScenario?.assumptions.mortgageTermYears ??
      0;
    const home: HomePositionDraft = {
      id: `plan-lab-home-${experiment.id}`,
      usage: "primary",
      mode: "new_purchase",
      purchaseMonth,
      purchasePrice,
      downPayment: downPaymentAmount,
      annualAppreciationPct: clampNonNegative(
        toNumber(experiment.annualAppreciationPct)
      ),
      mortgageRatePct: toNumber(mortgageRatePct),
      mortgageTermYears: toNumber(termYears),
      feesOneTime: clampNonNegative(toNumber(experiment.oneTimeFees)),
      holdingCostMonthly: clampNonNegative(toNumber(experiment.holdingCostMonthly)),
      holdingCostAnnualGrowthPct: 0,
    };
    return { home };
  }

  if (experiment.type === "carPlan") {
    const purchaseMonth = normalizeDraftMonth(
      `experiments.${experiment.id}.purchaseMonth`,
      experiment.purchaseMonth,
      params.warnings
    );
    if (!purchaseMonth) {
      return null;
    }
    const purchasePrice = clampNonNegative(toNumber(experiment.purchasePrice));
    if (purchasePrice <= 0) {
      return null;
    }
    const downPayment = clampNonNegative(toNumber(experiment.downPayment));
    const car: CarPositionDraft = {
      id: `plan-lab-car-${experiment.id}`,
      purchaseMonth,
      purchasePrice,
      downPayment,
      annualDepreciationRatePct: clampNonNegative(
        toNumber(experiment.annualDepreciationRatePct)
      ),
      holdingCostMonthly: clampNonNegative(toNumber(experiment.holdingCostMonthly)),
      holdingCostAnnualGrowthPct: clampNonNegative(
        toNumber(experiment.holdingCostAnnualGrowthPct)
      ),
      loan:
        experiment.loanPrincipal && experiment.loanInterestRatePct
          ? {
              principal: clampNonNegative(toNumber(experiment.loanPrincipal)),
              annualInterestRatePct: clampNonNegative(
                toNumber(experiment.loanInterestRatePct)
              ),
              termYears: clampNonNegative(toNumber(experiment.loanTermYears)),
              monthlyPayment:
                experiment.loanMonthlyPayment !== undefined
                  ? clampNonNegative(toNumber(experiment.loanMonthlyPayment))
                  : undefined,
            }
          : undefined,
    };
    return { car };
  }

  return null;
};

export const compilePlanLabExtras = (
  draft: PlanLabDraft,
  options: CompilePlanLabExtrasOptions = {}
): PlanLabExtrasCompilation => {
  const warnings: PlanLabDraftWarning[] = [];
  const positions: Partial<ScenarioPositions> = {};
  const eventDefinitions: EventDefinition[] = [];
  const eventRefs: ScenarioEventRef[] = [];
  const eventRefOverrides: ScenarioEventRef[] = [];
  const baselineScenario = options.baselineScenario;

  const baselineEdits = draft.baselineEdits ?? [];
  const enabledEdits = baselineEdits.filter((edit) => edit.isEnabled !== false);
  eventRefOverrides.push(...compileBaselineEdits(enabledEdits, warnings));

  const experiments = draft.experiments ?? [];
  const homeBuys: HomePositionDraft[] = [];
  const cars: CarPositionDraft[] = [];
  experiments.forEach((experiment) => {
    const compiled = compileExperimentToDefinition(experiment, {
      warnings,
      baselineScenario,
    });
    if (!compiled) {
      return;
    }
    if (compiled.definition) {
      eventDefinitions.push(compiled.definition);
      eventRefs.push({ refId: compiled.definition.id, enabled: true });
    }
    if (compiled.home) {
      homeBuys.push(compiled.home);
    }
    if (compiled.car) {
      cars.push(compiled.car);
    }
  });

  if (homeBuys.length > 0) {
    positions.homes = homeBuys;
  }
  if (cars.length > 0) {
    const baselineCars = baselineScenario?.positions?.cars ?? [];
    positions.cars = [...baselineCars, ...cars];
  }

  if (options.baselineScenario && options.eventLibrary) {
    const eventViews = buildScenarioEventViews(
      options.baselineScenario,
      options.eventLibrary
    );
    const rentEvents = eventViews.filter(
      (view) => view.definition.type === "rent" && view.ref.enabled
    );
    const hasRentBaseline = rentEvents.some((view) => {
      const edit = baselineEdits.find((item) => item.refId === view.ref.refId);
      return !edit || edit.action === "keep" || edit.isEnabled === false;
    });
    const hasHomeBuy = experiments.some(
      (experiment) => experiment.type === "homeBuy" && experiment.isEnabled !== false
    );
    if (hasRentBaseline && hasHomeBuy) {
      warnings.push({
        code: WarningCode.DoubleCountingHomeEvent,
        severity: "warning",
        messageKey: "warnings.doubleCountingHomeRent",
        defaultMessage:
          "Rent and home purchase are both active; double counting may occur.",
        refs: { scenarioId: options.baselineScenario.id },
      });
    }
  }

  return {
    positions,
    eventDefinitions,
    eventRefs,
    eventRefOverrides,
    warnings,
  };
};
