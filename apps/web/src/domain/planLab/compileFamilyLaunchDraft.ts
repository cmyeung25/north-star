import { addMonths } from "@north-star/engine";
import type { EventDefinition, ScenarioEventRef } from "../events/types";
import type {
  HomePositionDraft,
  Scenario,
  ScenarioAssumptions,
  ScenarioPositions,
} from "../../store/scenarioStore";
import type { PlanLabDraft } from "./types";
import {
  clampNonNegative,
  normalizeDraftMonth,
  toNumber,
  type PlanLabDraftWarning,
} from "./compileUtils";

type CompilePlanLabDraftOptions = {
  baselineScenario?: Scenario | null;
};

export const compileFamilyLaunchDraft = (
  draft: PlanLabDraft,
  options: CompilePlanLabDraftOptions = {}
) => {
  const warnings: PlanLabDraftWarning[] = [];
  const assumptions: Partial<ScenarioAssumptions> = {};
  const positions: Partial<ScenarioPositions> = {};
  const eventDefinitions: EventDefinition[] = [];
  const eventRefs: ScenarioEventRef[] = [];
  const baseline = options.baselineScenario;
  const family = draft.familyLaunch;

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

  const weddingMonth = normalizeDraftMonth(
    "familyLaunch.wedding.weddingMonth",
    family?.wedding?.weddingMonth,
    warnings
  );
  const weddingBudget = clampNonNegative(
    toNumber(family?.wedding?.weddingBudget)
  );
  const honeymoonBudget = clampNonNegative(
    toNumber(family?.wedding?.honeymoonBudget)
  );
  if (weddingMonth && weddingBudget + honeymoonBudget > 0) {
    const weddingDefinition: EventDefinition = {
      id: "plan-lab-wedding",
      title: "Plan Lab Wedding",
      type: "custom",
      kind: "cashflow",
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
    eventRefs.push({ refId: weddingDefinition.id, enabled: true });
  }

  const dueMonth = normalizeDraftMonth(
    "familyLaunch.baby.dueMonth",
    family?.baby?.dueMonth,
    warnings
  );
  if (dueMonth) {
    const duration = clampNonNegative(
      toNumber(family?.baby?.babyDurationMonths ?? 24)
    );
    const endMonth =
      duration > 0 ? addMonths(dueMonth, Math.max(0, Math.round(duration) - 1)) : null;
    const babyMonthlyBudget = clampNonNegative(
      toNumber(family?.baby?.babyMonthlyBudget)
    );
    if (babyMonthlyBudget > 0) {
      const babyDefinition: EventDefinition = {
        id: "plan-lab-family-baby",
        title: "Plan Lab Baby",
        type: "baby",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth: dueMonth,
          endMonth,
          monthlyAmount: babyMonthlyBudget,
          oneTimeAmount: 0,
          annualGrowthPct: 0,
        },
      };
      eventDefinitions.push(babyDefinition);
      eventRefs.push({ refId: babyDefinition.id, enabled: true });
    }
    const oneOffBudget = clampNonNegative(
      toNumber(family?.baby?.babyOneOffBudget)
    );
    if (oneOffBudget > 0) {
      const babyOneOffDefinition: EventDefinition = {
        id: "plan-lab-family-baby-one-off",
        title: "Plan Lab Baby One-Off",
        type: "baby",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth: dueMonth,
          endMonth: dueMonth,
          monthlyAmount: 0,
          oneTimeAmount: oneOffBudget,
          annualGrowthPct: 0,
        },
      };
      eventDefinitions.push(babyOneOffDefinition);
      eventRefs.push({ refId: babyOneOffDefinition.id, enabled: true });
    }
  }

  const housing = family?.housing;
  if (housing?.housingMode === "rent-upgrade") {
    const startMonth = normalizeDraftMonth(
      "familyLaunch.housing.rentStartMonth",
      housing.rentStartMonth ?? assumptions.baseMonth ?? baseline?.assumptions.baseMonth,
      warnings
    );
    if (startMonth) {
      const rentMonthly = clampNonNegative(
        toNumber(housing.upgradedRent ?? housing.currentRent)
      );
      if (rentMonthly > 0) {
        const rentDefinition: EventDefinition = {
          id: "plan-lab-family-rent-upgrade",
          title: "Plan Lab Rent Upgrade",
          type: "rent",
          kind: "cashflow",
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
        eventRefs.push({ refId: rentDefinition.id, enabled: true });
      }
    }
  }

  if (housing?.housingMode === "buy-home") {
    const purchaseMonth = normalizeDraftMonth(
      "familyLaunch.housing.purchaseMonth",
      housing.purchaseMonth,
      warnings
    );
    if (purchaseMonth) {
      const purchasePrice = clampNonNegative(toNumber(housing.homePrice));
      const downPaymentAmount =
        housing.downPaymentAmount !== undefined
          ? clampNonNegative(toNumber(housing.downPaymentAmount))
          : housing.downPaymentPct !== undefined
            ? clampNonNegative(purchasePrice * (toNumber(housing.downPaymentPct) / 100))
            : 0;
      const mortgageRatePct =
        housing.mortgageRatePct ??
        baseline?.assumptions.mortgageRatePct ??
        0;
      const termYears =
        housing.mortgageTermYears ??
        baseline?.assumptions.mortgageTermYears ??
        0;
      const home: HomePositionDraft = {
        id: "plan-lab-family-home",
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
      positions.homes = [home];
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
