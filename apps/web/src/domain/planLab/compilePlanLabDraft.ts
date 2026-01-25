import { addMonths } from "@north-star/engine";
import type { EventDefinition, ScenarioEventRef } from "../events/types";
import type {
  HomePositionDraft,
  Scenario,
  ScenarioAssumptions,
  ScenarioPositions,
} from "../../store/scenarioStore";
import { normalizeMonthStrict } from "../../utils/month";
import type { PlanLabDraft } from "./types";
import { WarningCode, type CompilerWarning } from "../warnings/types";

export type PlanLabDraftWarning = CompilerWarning;

export type PlanLabDraftCompilation = {
  assumptions: Partial<ScenarioAssumptions>;
  positions: Partial<ScenarioPositions>;
  eventDefinitions: EventDefinition[];
  eventRefs: ScenarioEventRef[];
  warnings: PlanLabDraftWarning[];
};

type CompilePlanLabDraftOptions = {
  baselineScenario?: Scenario | null;
};

const toNumber = (value: number | null | undefined, fallback = 0) => {
  const normalized = Number(value ?? fallback);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const clampNonNegative = (value: number) => Math.max(0, value);

const normalizeDraftMonth = (
  label: string,
  value: string | null | undefined,
  warnings: PlanLabDraftWarning[],
  meta?: Record<string, unknown>
): string | null => {
  if (!value) {
    return null;
  }
  const normalized = normalizeMonthStrict(value);
  if (!normalized.ok) {
    warnings.push({
      code: WarningCode.MonthInvalid,
      severity: "warning",
      messageKey: "warnings.monthInvalid",
      defaultMessage: `${label} has invalid month ${value}.`,
      refs: { month: value },
      debug: { ...meta, rawValue: value, reason: normalized.reason },
    });
    return null;
  }
  return normalized.month;
};

export const compilePlanLabDraft = (
  draft?: PlanLabDraft | null,
  options: CompilePlanLabDraftOptions = {}
): PlanLabDraftCompilation => {
  if (!draft) {
    return {
      assumptions: {},
      positions: {},
      eventDefinitions: [],
      eventRefs: [],
      warnings: [],
    };
  }

  const warnings: PlanLabDraftWarning[] = [];
  const assumptions: Partial<ScenarioAssumptions> = {};
  const positions: Partial<ScenarioPositions> = {};
  const eventDefinitions: EventDefinition[] = [];
  const eventRefs: ScenarioEventRef[] = [];
  const baseline = options.baselineScenario;

  const normalizedBaseMonth = normalizeDraftMonth(
    "baseMonth",
    draft.baseMonth,
    warnings
  );
  if (normalizedBaseMonth) {
    assumptions.baseMonth = normalizedBaseMonth;
  }
  if (draft.initialCash !== undefined) {
    assumptions.initialCash = clampNonNegative(toNumber(draft.initialCash));
  }

  if (draft.housing?.kind === "buy") {
    const purchaseMonth = normalizeDraftMonth(
      "housing.purchaseMonth",
      draft.housing.purchaseMonth,
      warnings
    );
    if (purchaseMonth) {
      const purchasePrice = clampNonNegative(toNumber(draft.housing.purchasePrice));
      const downPaymentAmount =
        draft.housing.downPaymentAmount !== undefined
          ? clampNonNegative(toNumber(draft.housing.downPaymentAmount))
          : draft.housing.downPaymentPct !== undefined
            ? clampNonNegative(
                purchasePrice * (toNumber(draft.housing.downPaymentPct) / 100)
              )
            : 0;
      const mortgageRatePct =
        draft.housing.mortgageRatePct ?? baseline?.assumptions.mortgageRatePct ?? 0;
      const termYears =
        draft.housing.termYears ?? baseline?.assumptions.mortgageTermYears ?? 0;
      const home: HomePositionDraft = {
        id: "plan-lab-home",
        usage: "primary",
        mode: "new_purchase",
        purchaseMonth,
        purchasePrice,
        downPayment: downPaymentAmount,
        annualAppreciationPct: 0,
        mortgageRatePct: toNumber(mortgageRatePct),
        mortgageTermYears: toNumber(termYears),
        feesOneTime: clampNonNegative(toNumber(draft.housing.oneTimeFees)),
        holdingCostMonthly: clampNonNegative(toNumber(draft.housing.holdingCostMonthly)),
        holdingCostAnnualGrowthPct: 0,
      };
      positions.homes = [home];
    }
  }

  if (draft.housing?.kind === "rent") {
    const startMonth = normalizeDraftMonth(
      "housing.startMonth",
      draft.housing.startMonth,
      warnings
    );
    if (startMonth) {
      const rentMonthly = clampNonNegative(
        toNumber(draft.housing.monthlyRent ?? baseline?.assumptions.rentMonthly)
      );
      const rentGrowth = toNumber(
        draft.housing.annualRentGrowthPct ??
          baseline?.assumptions.rentAnnualGrowthPct ??
          0
      );
      const rentDefinition: EventDefinition = {
        id: "plan-lab-rent",
        title: "Plan Lab Rent",
        type: "rent",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth,
          endMonth: null,
          monthlyAmount: rentMonthly,
          oneTimeAmount: 0,
          annualGrowthPct: rentGrowth,
        },
      };
      eventDefinitions.push(rentDefinition);
      eventRefs.push({ refId: rentDefinition.id, enabled: true });
    }
  }

  if (draft.babyPlan) {
    const targetMonth = normalizeDraftMonth(
      "babyPlan.targetMonth",
      draft.babyPlan.targetMonth ?? draft.targetMonth,
      warnings
    );
    if (targetMonth) {
      const duration = clampNonNegative(toNumber(draft.babyPlan.durationMonths));
      const endMonth =
        duration > 0 ? addMonths(targetMonth, Math.max(0, Math.round(duration) - 1)) : null;
      const babyDefinition: EventDefinition = {
        id: "plan-lab-baby",
        title: "Plan Lab Baby",
        type: "baby",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth: targetMonth,
          endMonth,
          monthlyAmount: clampNonNegative(toNumber(draft.babyPlan.monthlyBabyBudget)),
          oneTimeAmount: 0,
          annualGrowthPct: 0,
        },
      };
      eventDefinitions.push(babyDefinition);
      eventRefs.push({ refId: babyDefinition.id, enabled: true });
      const oneOffAmount = clampNonNegative(
        toNumber(draft.babyPlan.oneOffBabyCost)
      );
      if (oneOffAmount > 0) {
        const babyOneOffDefinition: EventDefinition = {
          id: "plan-lab-baby-one-off",
          title: "Plan Lab Baby One-Off",
          type: "baby",
          kind: "cashflow",
          rule: {
            mode: "params",
            startMonth: targetMonth,
            endMonth: targetMonth,
            monthlyAmount: 0,
            oneTimeAmount: oneOffAmount,
            annualGrowthPct: 0,
          },
        };
        eventDefinitions.push(babyOneOffDefinition);
        eventRefs.push({ refId: babyOneOffDefinition.id, enabled: true });
      }
    }
  }

  return {
    assumptions,
    positions,
    eventDefinitions,
    eventRefs,
    warnings,
  };
};
