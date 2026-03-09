import { addMonths } from "@north-star/engine";
import type {
  PlanLabDecisionTemplateAvailability,
  PlanLabDecisionTemplateDefaultPayload,
  PlanLabDecisionTemplateId,
  PlanLabDecisionTemplateSpec,
} from "../../src/domain/planLab/types";
import { isValidMonthKey } from "../../src/utils/monthKey";

type TranslateFn = (
  key: string,
  fallback: string,
  values?: Record<string, string | number>
) => string;

export type PlanLabCostProfileTier = "conservative" | "median" | "aggressive";

export type PlanLabCostRangeItem = {
  id: string;
  label: string;
  values: Record<PlanLabCostProfileTier, string>;
  factorHint: string;
};

type PlanLabDecisionTemplateContext = {
  hasEligibleIncomeEvent: boolean;
  translate: TranslateFn;
  selectedCostProfile: Partial<Record<PlanLabDecisionTemplateId, PlanLabCostProfileTier>>;
};

type PlanLabCostRangeItemConfig = {
  id: string;
  labelKey: string;
  labelFallback: string;
  valueKeys: Record<PlanLabCostProfileTier, string>;
  valueFallbacks: Record<PlanLabCostProfileTier, string>;
  factorHintKey: string;
  factorHintFallback: string;
};

type PlanLabDecisionTemplateCatalogItem = PlanLabDecisionTemplateSpec & {
  titleKey: string;
  titleFallback: string;
  descriptionKey: string;
  descriptionFallback: string;
  estimateGuideKey: string;
  estimateGuideFallback: string;
  costRangeItems: PlanLabCostRangeItemConfig[];
  availabilityGuard: (
    context: PlanLabDecisionTemplateContext
  ) => PlanLabDecisionTemplateAvailability;
};

export type PlanLabDecisionTemplateOption = {
  id: PlanLabDecisionTemplateId;
  launcher: PlanLabDecisionTemplateSpec["launcher"];
  title: string;
  description: string;
  availability: PlanLabDecisionTemplateAvailability;
  defaultPayload?: PlanLabDecisionTemplateDefaultPayload;
  selectedCostProfile: PlanLabCostProfileTier;
  estimateGuide: string;
  costRangeItems: PlanLabCostRangeItem[];
};

export const INCOME_SHOCK_DEFAULT_PAYLOAD: Required<
  NonNullable<PlanLabDecisionTemplateDefaultPayload["incomeShock"]>
> = {
  amountMultiplier: 0.8,
  durationMonths: 12,
  startOffsetMonths: 1,
};

export type PlanLabIncomeShockPayload = {
  amountMultiplier: number;
  durationMonths: number;
  startOffsetMonths: number;
  startMonth: string;
  endMonth: string;
};

const buildCostRangeItems = (
  item: PlanLabDecisionTemplateCatalogItem,
  translate: TranslateFn
): PlanLabCostRangeItem[] =>
  item.costRangeItems.map((costItem) => ({
    id: costItem.id,
    label: translate(costItem.labelKey, costItem.labelFallback),
    values: {
      conservative: translate(
        costItem.valueKeys.conservative,
        costItem.valueFallbacks.conservative
      ),
      median: translate(costItem.valueKeys.median, costItem.valueFallbacks.median),
      aggressive: translate(
        costItem.valueKeys.aggressive,
        costItem.valueFallbacks.aggressive
      ),
    },
    factorHint: translate(costItem.factorHintKey, costItem.factorHintFallback),
  }));

export const PLAN_LAB_DECISION_TEMPLATE_CATALOG: PlanLabDecisionTemplateCatalogItem[] = [
  {
    id: "marriage",
    launcher: "bundle_marriage",
    titleKey: "planLabDecisionTemplateMarriageTitle",
    titleFallback: "Marriage",
    descriptionKey: "planLabDecisionTemplateMarriageDesc",
    descriptionFallback: "Plan wedding and post-marriage setup costs.",
    estimateGuideKey: "planLabDecisionTemplateMarriageGuide",
    estimateGuideFallback: "Ranges vary by banquet scale, guest count, and ceremony style.",
    costRangeItems: [
      {
        id: "wedding",
        labelKey: "planLabCostMarriageWedding",
        labelFallback: "Wedding and banquet",
        valueKeys: {
          conservative: "planLabCostMarriageWeddingConservative",
          median: "planLabCostMarriageWeddingMedian",
          aggressive: "planLabCostMarriageWeddingAggressive",
        },
        valueFallbacks: {
          conservative: "HKD 120k-220k",
          median: "HKD 250k-450k",
          aggressive: "HKD 500k-900k",
        },
        factorHintKey: "planLabCostMarriageWeddingFactor",
        factorHintFallback: "Driven by district, venue type, and guest count.",
      },
    ],
    availabilityGuard: () => ({ enabled: true }),
  },
  {
    id: "childbirth",
    launcher: "bundle_childbirth",
    titleKey: "planLabDecisionTemplateChildbirthTitle",
    titleFallback: "Childbirth",
    descriptionKey: "planLabDecisionTemplateChildbirthDesc",
    descriptionFallback: "Estimate one-off delivery and early infant setup costs.",
    estimateGuideKey: "planLabDecisionTemplateChildbirthGuide",
    estimateGuideFallback:
      "Ranges vary by public/private hospital options and postpartum care choices.",
    costRangeItems: [
      {
        id: "delivery",
        labelKey: "planLabCostChildbirthDelivery",
        labelFallback: "Delivery and maternity package",
        valueKeys: {
          conservative: "planLabCostChildbirthDeliveryConservative",
          median: "planLabCostChildbirthDeliveryMedian",
          aggressive: "planLabCostChildbirthDeliveryAggressive",
        },
        valueFallbacks: {
          conservative: "HKD 20k-60k",
          median: "HKD 80k-180k",
          aggressive: "HKD 200k-400k",
        },
        factorHintKey: "planLabCostChildbirthDeliveryFactor",
        factorHintFallback: "Driven by hospital class, doctor fees, and room preference.",
      },
    ],
    availabilityGuard: () => ({ enabled: true }),
  },
  {
    id: "parenting",
    launcher: "bundle_parenting",
    titleKey: "planLabDecisionTemplateParentingTitle",
    titleFallback: "Parenting",
    descriptionKey: "planLabDecisionTemplateParentingDesc",
    descriptionFallback: "Model recurring childcare and education spending.",
    estimateGuideKey: "planLabDecisionTemplateParentingGuide",
    estimateGuideFallback:
      "Ranges vary by helper/daycare choice, school pathway, and activity intensity.",
    costRangeItems: [
      {
        id: "childcare",
        labelKey: "planLabCostParentingChildcare",
        labelFallback: "Monthly childcare and school",
        valueKeys: {
          conservative: "planLabCostParentingChildcareConservative",
          median: "planLabCostParentingChildcareMedian",
          aggressive: "planLabCostParentingChildcareAggressive",
        },
        valueFallbacks: {
          conservative: "HKD 4k-8k / month",
          median: "HKD 10k-20k / month",
          aggressive: "HKD 25k-45k / month",
        },
        factorHintKey: "planLabCostParentingChildcareFactor",
        factorHintFallback:
          "Driven by local/international school choice and helper/tutoring needs.",
      },
    ],
    availabilityGuard: () => ({ enabled: true }),
  },
  {
    id: "housing",
    launcher: "bundle_housing",
    titleKey: "planLabDecisionTemplateHousingTitle",
    titleFallback: "Buy home / rent",
    descriptionKey: "planLabDecisionTemplateHousingDesc",
    descriptionFallback: "Compare ownership and rental paths with local cost ranges.",
    estimateGuideKey: "planLabDecisionTemplateHousingGuide",
    estimateGuideFallback:
      "Ranges vary by district, floor area, ownership vs rental mode, and mortgage terms.",
    costRangeItems: [
      {
        id: "housingMonthly",
        labelKey: "planLabCostHousingMonthly",
        labelFallback: "Monthly housing outflow",
        valueKeys: {
          conservative: "planLabCostHousingMonthlyConservative",
          median: "planLabCostHousingMonthlyMedian",
          aggressive: "planLabCostHousingMonthlyAggressive",
        },
        valueFallbacks: {
          conservative: "HKD 12k-20k / month",
          median: "HKD 22k-38k / month",
          aggressive: "HKD 40k-75k / month",
        },
        factorHintKey: "planLabCostHousingMonthlyFactor",
        factorHintFallback:
          "Driven by district premium, rent vs mortgage, and management/holding costs.",
      },
    ],
    availabilityGuard: () => ({ enabled: true }),
  },
  {
    id: "retirement",
    launcher: "bundle_retirement",
    titleKey: "planLabDecisionTemplateRetirementTitle",
    titleFallback: "Retirement",
    descriptionKey: "planLabDecisionTemplateRetirementDesc",
    descriptionFallback: "Estimate retirement drawdown and healthcare costs.",
    estimateGuideKey: "planLabDecisionTemplateRetirementGuide",
    estimateGuideFallback:
      "Ranges vary by retirement age, medical inflation, and lifestyle choices.",
    costRangeItems: [
      {
        id: "retirementMonthly",
        labelKey: "planLabCostRetirementMonthly",
        labelFallback: "Monthly retirement spending",
        valueKeys: {
          conservative: "planLabCostRetirementMonthlyConservative",
          median: "planLabCostRetirementMonthlyMedian",
          aggressive: "planLabCostRetirementMonthlyAggressive",
        },
        valueFallbacks: {
          conservative: "HKD 10k-18k / month",
          median: "HKD 20k-35k / month",
          aggressive: "HKD 38k-60k / month",
        },
        factorHintKey: "planLabCostRetirementMonthlyFactor",
        factorHintFallback:
          "Driven by housing mode in retirement, healthcare plan, and travel frequency.",
      },
    ],
    availabilityGuard: () => ({ enabled: true }),
  },
  {
    id: "income_shock",
    launcher: "income_shock_override",
    defaultPayload: {
      incomeShock: INCOME_SHOCK_DEFAULT_PAYLOAD,
    },
    titleKey: "planLabDecisionTemplateIncomeShockTitle",
    titleFallback: "Income shock",
    descriptionKey: "planLabDecisionTemplateIncomeShockDesc",
    descriptionFallback: "Apply -20% income for 12 months from next month.",
    estimateGuideKey: "planLabDecisionTemplateIncomeShockGuide",
    estimateGuideFallback: "This template estimates downside resilience, not long-term baseline.",
    costRangeItems: [],
    availabilityGuard: ({ hasEligibleIncomeEvent }) =>
      hasEligibleIncomeEvent
        ? { enabled: true }
        : {
            enabled: false,
            reasonKey: "planLabDecisionTemplateIncomeShockDisabled",
            reasonFallback: "No editable baseline income event available.",
          },
  },
];

const resolveMonthAnchor = (
  baseMonth: string | null | undefined,
  fallbackStartMonth: string | null | undefined
): string | null => {
  if (isValidMonthKey(baseMonth ?? "")) {
    return baseMonth as string;
  }
  if (isValidMonthKey(fallbackStartMonth ?? "")) {
    return fallbackStartMonth as string;
  }
  return null;
};

export const buildIncomeShockDefaultPayload = (params: {
  baseMonth?: string | null;
  fallbackStartMonth?: string | null;
  defaults?: NonNullable<PlanLabDecisionTemplateDefaultPayload["incomeShock"]>;
}): PlanLabIncomeShockPayload | null => {
  const defaults = params.defaults ?? INCOME_SHOCK_DEFAULT_PAYLOAD;
  const anchor = resolveMonthAnchor(params.baseMonth, params.fallbackStartMonth);
  if (!anchor) {
    return null;
  }

  const durationMonths = Math.max(1, Math.floor(defaults.durationMonths));
  const startOffsetMonths = Math.floor(defaults.startOffsetMonths);
  const startMonth = addMonths(anchor, startOffsetMonths);
  const endMonth = addMonths(startMonth, durationMonths - 1);

  return {
    amountMultiplier: defaults.amountMultiplier,
    durationMonths,
    startOffsetMonths,
    startMonth,
    endMonth,
  };
};

export const buildPlanLabDecisionTemplateOptions = (
  context: PlanLabDecisionTemplateContext
): PlanLabDecisionTemplateOption[] =>
  PLAN_LAB_DECISION_TEMPLATE_CATALOG.map((item) => {
    const availability = item.availabilityGuard(context);
    const selectedCostProfile = context.selectedCostProfile[item.id] ?? "median";
    return {
      id: item.id,
      launcher: item.launcher,
      title: context.translate(item.titleKey, item.titleFallback),
      description: context.translate(item.descriptionKey, item.descriptionFallback),
      availability,
      defaultPayload: item.defaultPayload,
      selectedCostProfile,
      estimateGuide: context.translate(item.estimateGuideKey, item.estimateGuideFallback),
      costRangeItems: buildCostRangeItems(item, context.translate),
    };
  });
