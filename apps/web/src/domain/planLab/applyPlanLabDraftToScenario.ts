import { addMonths } from "@north-star/engine";
import { nanoid } from "nanoid";
import type { EventDefinition, ScenarioEventRef } from "../events/types";
import type { HomePositionDraft, Scenario, ScenarioPositions } from "../../store/scenarioStore";
import { normalizeMonthStrict } from "../../utils/month";
import type { PlanLabDraft } from "./types";

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
  warnings: PlanLabScenarioApplyWarning[];
  errors: PlanLabScenarioApplyError[];
};

const PLAN_LAB_EVENT_PREFIX = "planLab:";

const buildPlanLabEventId = (scenarioId: string, suffix: string) =>
  `${PLAN_LAB_EVENT_PREFIX}${scenarioId}:${suffix}`;

const isPlanLabEventId = (refId: string) => refId.startsWith(PLAN_LAB_EVENT_PREFIX);

const clampNonNegative = (value: number) => Math.max(0, value);

const toNumber = (value: number | null | undefined, fallback = 0) => {
  const normalized = Number(value ?? fallback);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const normalizeRequiredMonth = (
  field: string,
  value: string | null | undefined,
  errors: PlanLabScenarioApplyError[]
): string | null => {
  if (!value) {
    errors.push({
      code: "missing-month",
      field,
      message: `${field} is required.`,
    });
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
  options: { scenarioId: string }
): PlanLabScenarioApplyResult => {
  const errors: PlanLabScenarioApplyError[] = [];
  const warnings: PlanLabScenarioApplyWarning[] = [];
  const eventDefinitions: EventDefinition[] = [];
  const planLabEventRefs: ScenarioEventRef[] = [];
  const existingHomes =
    baseScenario.positions?.homes?.length ||
    (baseScenario.positions?.home ? 1 : 0) ||
    0;

  let nextPositions: ScenarioPositions | undefined = baseScenario.positions
    ? { ...baseScenario.positions }
    : undefined;
  let nextEventRefs = (baseScenario.eventRefs ?? []).filter(
    (ref) => !isPlanLabEventId(ref.refId)
  );

  if (draft.goalType === "family-launch") {
    const family = draft.familyLaunch;
    const weddingMonth = normalizeOptionalMonth(
      "familyLaunch.wedding.weddingMonth",
      family?.wedding?.weddingMonth,
      errors
    );
    const weddingBudget = clampNonNegative(
      toNumber(family?.wedding?.weddingBudget)
    );
    const honeymoonBudget = clampNonNegative(
      toNumber(family?.wedding?.honeymoonBudget)
    );
    if (weddingMonth && weddingBudget + honeymoonBudget > 0) {
      const weddingDefinition: EventDefinition = {
        id: buildPlanLabEventId(options.scenarioId, "wedding"),
        title: "Plan Lab Wedding",
        type: "custom",
        kind: "cashflow",
        currency: baseScenario.baseCurrency,
        rule: {
          mode: "params",
          startMonth: weddingMonth,
          endMonth: weddingMonth,
          monthlyAmount: 0,
          oneTimeAmount: weddingBudget + honeymoonBudget,
          annualGrowthPct: 0,
        },
      };
      eventDefinitions.push(weddingDefinition);
      planLabEventRefs.push({ refId: weddingDefinition.id, enabled: true });
    }

    const babyInputs = family?.baby;
    const hasBabyInputs =
      Boolean(babyInputs?.dueMonth) ||
      babyInputs?.babyMonthlyBudget !== undefined ||
      babyInputs?.babyOneOffBudget !== undefined ||
      babyInputs?.babyDurationMonths !== undefined;
    if (hasBabyInputs) {
      const dueMonth = normalizeRequiredMonth(
        "familyLaunch.baby.dueMonth",
        babyInputs?.dueMonth,
        errors
      );
      if (dueMonth) {
        const duration = clampNonNegative(
          toNumber(babyInputs?.babyDurationMonths ?? 24)
        );
        const endMonth =
          duration > 0
            ? addMonths(dueMonth, Math.max(0, Math.round(duration) - 1))
            : null;
        const monthlyBudget = clampNonNegative(
          toNumber(babyInputs?.babyMonthlyBudget)
        );
        if (monthlyBudget > 0) {
          const babyDefinition: EventDefinition = {
            id: buildPlanLabEventId(options.scenarioId, "baby"),
            title: "Plan Lab Baby",
            type: "baby",
            kind: "cashflow",
            currency: baseScenario.baseCurrency,
            rule: {
              mode: "params",
              startMonth: dueMonth,
              endMonth,
              monthlyAmount: monthlyBudget,
              oneTimeAmount: 0,
              annualGrowthPct: 0,
            },
          };
          eventDefinitions.push(babyDefinition);
          planLabEventRefs.push({ refId: babyDefinition.id, enabled: true });
        }
        const oneOffAmount = clampNonNegative(
          toNumber(babyInputs?.babyOneOffBudget)
        );
        if (oneOffAmount > 0) {
          const babyOneOffDefinition: EventDefinition = {
            id: buildPlanLabEventId(options.scenarioId, "baby-one-off"),
            title: "Plan Lab Baby One-Off",
            type: "baby",
            kind: "cashflow",
            currency: baseScenario.baseCurrency,
            rule: {
              mode: "params",
              startMonth: dueMonth,
              endMonth: dueMonth,
              monthlyAmount: 0,
              oneTimeAmount: oneOffAmount,
              annualGrowthPct: 0,
            },
          };
          eventDefinitions.push(babyOneOffDefinition);
          planLabEventRefs.push({ refId: babyOneOffDefinition.id, enabled: true });
        }
      }
    }

    const housing = family?.housing;
    if (housing?.housingMode === "rent-upgrade") {
      const startMonth = normalizeRequiredMonth(
        "familyLaunch.housing.rentStartMonth",
        housing.rentStartMonth ?? baseScenario.assumptions.baseMonth,
        errors
      );
      if (startMonth) {
        const rentMonthly = clampNonNegative(
          toNumber(housing.upgradedRent ?? housing.currentRent)
        );
        if (rentMonthly > 0) {
          const rentDefinition: EventDefinition = {
            id: buildPlanLabEventId(options.scenarioId, "rent-upgrade"),
            title: "Plan Lab Rent Upgrade",
            type: "rent",
            kind: "cashflow",
            currency: baseScenario.baseCurrency,
            rule: {
              mode: "params",
              startMonth,
              endMonth: null,
              monthlyAmount: rentMonthly,
              oneTimeAmount: 0,
              annualGrowthPct: 0,
            },
          };
          eventDefinitions.push(rentDefinition);
          planLabEventRefs.push({ refId: rentDefinition.id, enabled: true });
        }
      }
    }

    if (housing?.housingMode === "buy-home") {
      const purchaseMonth = normalizeRequiredMonth(
        "familyLaunch.housing.purchaseMonth",
        housing.purchaseMonth,
        errors
      );
      if (purchaseMonth) {
        const purchasePrice = clampNonNegative(toNumber(housing.homePrice));
        const downPaymentAmount =
          housing.downPaymentAmount !== undefined
            ? clampNonNegative(toNumber(housing.downPaymentAmount))
            : housing.downPaymentPct !== undefined
              ? clampNonNegative(
                  purchasePrice * (toNumber(housing.downPaymentPct) / 100)
                )
              : 0;
        const mortgageRatePct =
          housing.mortgageRatePct ?? baseScenario.assumptions.mortgageRatePct ?? 0;
        const termYears =
          housing.mortgageTermYears ??
          baseScenario.assumptions.mortgageTermYears ??
          0;
        const home: HomePositionDraft = {
          id: `plan-lab-home-${nanoid(6)}`,
          usage: "primary",
          mode: "new_purchase",
          purchaseMonth,
          purchasePrice,
          downPayment: downPaymentAmount,
          annualAppreciationPct: clampNonNegative(
            toNumber(housing.annualAppreciationPct)
          ),
          mortgageRatePct: toNumber(mortgageRatePct),
          mortgageTermYears: toNumber(termYears),
          feesOneTime: clampNonNegative(toNumber(housing.oneOffFees)),
          holdingCostMonthly: clampNonNegative(toNumber(housing.monthlyHoldingCost)),
          holdingCostAnnualGrowthPct: 0,
        };
        if (existingHomes > 0) {
          warnings.push({
            code: "replace-homes",
            message: "Plan Lab housing will replace existing home positions.",
          });
        }
        nextPositions = {
          ...(nextPositions ?? {}),
          home: undefined,
          homes: [home],
        };
      }
    }
  }

  if (draft.goalType !== "family-launch" && draft.housing?.kind === "buy") {
    const purchaseMonth = normalizeRequiredMonth(
      "housing.purchaseMonth",
      draft.housing.purchaseMonth,
      errors
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
        draft.housing.mortgageRatePct ?? baseScenario.assumptions.mortgageRatePct ?? 0;
      const termYears =
        draft.housing.termYears ?? baseScenario.assumptions.mortgageTermYears ?? 0;
      const home: HomePositionDraft = {
        id: `plan-lab-home-${nanoid(6)}`,
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
      if (existingHomes > 0) {
        warnings.push({
          code: "replace-homes",
          message: "Plan Lab housing will replace existing home positions.",
        });
      }
      nextPositions = {
        ...(nextPositions ?? {}),
        home: undefined,
        homes: [home],
      };
    }
  }

  if (draft.goalType !== "family-launch" && draft.housing?.kind === "rent") {
    const startMonth = normalizeRequiredMonth(
      "housing.startMonth",
      draft.housing.startMonth,
      errors
    );
    if (startMonth) {
      const rentMonthly = clampNonNegative(
        toNumber(draft.housing.monthlyRent ?? baseScenario.assumptions.rentMonthly)
      );
      const rentGrowth = toNumber(
        draft.housing.annualRentGrowthPct ??
          baseScenario.assumptions.rentAnnualGrowthPct ??
          0
      );
      const rentDefinition: EventDefinition = {
        id: buildPlanLabEventId(options.scenarioId, "rent"),
        title: "Plan Lab Rent",
        type: "rent",
        kind: "cashflow",
        currency: baseScenario.baseCurrency,
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
      planLabEventRefs.push({ refId: rentDefinition.id, enabled: true });
    }
  }

  if (draft.goalType !== "family-launch" && draft.babyPlan) {
    const hasBabyInputs =
      draft.babyPlan.targetMonth ||
      draft.babyPlan.monthlyBabyBudget !== undefined ||
      draft.babyPlan.oneOffBabyCost !== undefined ||
      draft.babyPlan.durationMonths !== undefined;
    if (hasBabyInputs) {
      const targetMonth = normalizeRequiredMonth(
        "babyPlan.targetMonth",
        draft.babyPlan.targetMonth ?? draft.targetMonth,
        errors
      );
      if (targetMonth) {
        const duration = clampNonNegative(toNumber(draft.babyPlan.durationMonths));
        const endMonth =
          duration > 0
            ? addMonths(targetMonth, Math.max(0, Math.round(duration) - 1))
            : null;
        const monthlyBudget = clampNonNegative(
          toNumber(draft.babyPlan.monthlyBabyBudget)
        );
        if (monthlyBudget > 0) {
          const babyDefinition: EventDefinition = {
            id: buildPlanLabEventId(options.scenarioId, "baby"),
            title: "Plan Lab Baby",
            type: "baby",
            kind: "cashflow",
            currency: baseScenario.baseCurrency,
            rule: {
              mode: "params",
              startMonth: targetMonth,
              endMonth,
              monthlyAmount: monthlyBudget,
              oneTimeAmount: 0,
              annualGrowthPct: 0,
            },
          };
          eventDefinitions.push(babyDefinition);
          planLabEventRefs.push({ refId: babyDefinition.id, enabled: true });
        }
        const oneOffAmount = clampNonNegative(
          toNumber(draft.babyPlan.oneOffBabyCost)
        );
        if (oneOffAmount > 0) {
          const babyOneOffDefinition: EventDefinition = {
            id: buildPlanLabEventId(options.scenarioId, "baby-one-off"),
            title: "Plan Lab Baby One-Off",
            type: "baby",
            kind: "cashflow",
            currency: baseScenario.baseCurrency,
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
          planLabEventRefs.push({ refId: babyOneOffDefinition.id, enabled: true });
        }
      }
    }
  }

  if (errors.length > 0) {
    return {
      scenario: baseScenario,
      eventDefinitions: [],
      warnings,
      errors,
    };
  }

  nextEventRefs = [...nextEventRefs, ...planLabEventRefs];

  return {
    scenario: {
      ...baseScenario,
      positions: nextPositions,
      eventRefs: nextEventRefs,
      updatedAt: Date.now(),
    },
    eventDefinitions,
    warnings,
    errors,
  };
};
