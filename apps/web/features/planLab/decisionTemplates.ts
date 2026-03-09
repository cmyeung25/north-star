import { addMonths } from "@north-star/engine";
import type {
  BundleWizardInput,
  HomePurchaseBundleInput,
  NewBabyPlanInput,
  RentalPlanBundleInput,
  WeddingStyle,
} from "../../src/domain/eventTemplates/bundles";
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

const resolveAnchorMonth = (baseMonth?: string | null): string =>
  isValidMonthKey(baseMonth ?? "") ? (baseMonth as string) : "";

const resolveMarriageDefaults = (
  tier: PlanLabCostProfileTier
): Pick<Extract<BundleWizardInput, { templateId: "life_marriage_plan" }>['input'], 'weddingStyle' | 'totalWeddingBudget'> => {
  if (tier === "conservative") {
    return { weddingStyle: "small_banquet", totalWeddingBudget: 120000 };
  }
  if (tier === "aggressive") {
    return { weddingStyle: "luxury_wedding", totalWeddingBudget: 600000 };
  }
  return { weddingStyle: "hotel_banquet", totalWeddingBudget: 300000 };
};

const resolveChildbirthDefaults = (tier: PlanLabCostProfileTier): NewBabyPlanInput => {
  if (tier === "conservative") {
    return {
      birthMonth: "",
      deliveryCost: 40000,
      childcareMonthly: 5000,
      helperEnabled: false,
      helperMonthly: 0,
      agencyFee: 0,
      schoolingEnabled: false,
      schoolingAmount: 0,
      schoolingCadence: "monthly",
    };
  }
  if (tier === "aggressive") {
    return {
      birthMonth: "",
      deliveryCost: 260000,
      childcareMonthly: 22000,
      helperEnabled: true,
      helperMonthly: 7000,
      agencyFee: 18000,
      schoolingEnabled: true,
      schoolingAmount: 7000,
      schoolingCadence: "monthly",
    };
  }
  return {
    birthMonth: "",
    deliveryCost: 120000,
    childcareMonthly: 12000,
    helperEnabled: true,
    helperMonthly: 5500,
    agencyFee: 12000,
    schoolingEnabled: false,
    schoolingAmount: 0,
    schoolingCadence: "monthly",
  };
};

const resolveHomePurchaseDefaults = (
  tier: PlanLabCostProfileTier
): HomePurchaseBundleInput => {
  if (tier === "conservative") {
    return {
      startMonth: "",
      purchasePrice: 6000000,
      downPaymentMode: "percent",
      downPaymentPercent: 30,
      mortgageRatePct: 3.25,
      mortgageTermYears: 30,
      mortgagePayment: 18300,
      mortgagePaymentIsEstimated: true,
    };
  }
  if (tier === "aggressive") {
    return {
      startMonth: "",
      purchasePrice: 15000000,
      downPaymentMode: "percent",
      downPaymentPercent: 40,
      mortgageRatePct: 4,
      mortgageTermYears: 30,
      mortgagePayment: 43000,
      mortgagePaymentIsEstimated: true,
    };
  }
  return {
    startMonth: "",
    purchasePrice: 9000000,
    downPaymentMode: "percent",
    downPaymentPercent: 35,
    mortgageRatePct: 3.5,
    mortgageTermYears: 30,
    mortgagePayment: 30000,
    mortgagePaymentIsEstimated: true,
  };
};

const resolveRentalPlanDefaults = (
  tier: PlanLabCostProfileTier
): RentalPlanBundleInput => {
  if (tier === "conservative") {
    return {
      startMonth: "",
      rentMonthly: 16000,
      rentAnnualGrowthPct: 2.5,
      depositAmount: 32000,
      agentFeeAmount: 8000,
    };
  }
  if (tier === "aggressive") {
    return {
      startMonth: "",
      rentMonthly: 50000,
      rentAnnualGrowthPct: 4,
      depositAmount: 100000,
      agentFeeAmount: 25000,
    };
  }
  return {
    startMonth: "",
    rentMonthly: 28000,
    rentAnnualGrowthPct: 3,
    depositAmount: 56000,
    agentFeeAmount: 14000,
  };
};

export const buildBundleWizardInputForDecisionTemplate = (params: {
  templateId: Exclude<
    PlanLabDecisionTemplateId,
    "retirement" | "income_shock"
  >;
  selectedCostProfile: PlanLabCostProfileTier;
  baseMonth?: string | null;
}): BundleWizardInput => {
  const anchorMonth = resolveAnchorMonth(params.baseMonth);
  if (params.templateId === "marriage") {
    const defaults = resolveMarriageDefaults(params.selectedCostProfile);
    return {
      templateId: "life_marriage_plan",
      input: {
        weddingMonth: anchorMonth,
        weddingStyle: defaults.weddingStyle as WeddingStyle,
        totalWeddingBudget: defaults.totalWeddingBudget,
        breakdownEnabled: false,
        breakdownItems: [],
        includeTravel: false,
      },
    };
  }
  if (params.templateId === "home_purchase") {
    return {
      templateId: "life_home_purchase",
      input: {
        ...resolveHomePurchaseDefaults(params.selectedCostProfile),
        startMonth: anchorMonth,
      },
    };
  }
  if (params.templateId === "rental_plan") {
    return {
      templateId: "life_rental_plan",
      input: {
        ...resolveRentalPlanDefaults(params.selectedCostProfile),
        startMonth: anchorMonth,
      },
    };
  }

  const childbirthDefaults = resolveChildbirthDefaults(params.selectedCostProfile);
  return {
    templateId: "life_new_baby_plan",
    input: {
      ...childbirthDefaults,
      birthMonth: anchorMonth,
      schoolingStartMonth: anchorMonth,
      ...(params.templateId === "parenting"
        ? {
            deliveryCost: 0,
            schoolingEnabled: true,
            schoolingAmount:
              params.selectedCostProfile === "conservative"
                ? 2500
                : params.selectedCostProfile === "aggressive"
                  ? 12000
                  : 6000,
          }
        : null),
    },
  };
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
    id: "home_purchase",
    launcher: "bundle_housing",
    titleKey: "planLabDecisionTemplateHomePurchaseTitle",
    titleFallback: "Home purchase",
    descriptionKey: "planLabDecisionTemplateHomePurchaseDesc",
    descriptionFallback: "Use the buy-home flow with local mortgage and down-payment ranges.",
    estimateGuideKey: "planLabDecisionTemplateHomePurchaseGuide",
    estimateGuideFallback:
      "Ranges vary by district, floor area, down-payment ratio, and mortgage terms.",
    costRangeItems: [
      {
        id: "homePurchaseMonthly",
        labelKey: "planLabCostHomePurchaseMonthly",
        labelFallback: "Monthly owner housing outflow",
        valueKeys: {
          conservative: "planLabCostHomePurchaseMonthlyConservative",
          median: "planLabCostHomePurchaseMonthlyMedian",
          aggressive: "planLabCostHomePurchaseMonthlyAggressive",
        },
        valueFallbacks: {
          conservative: "HKD 15k-25k / month",
          median: "HKD 28k-42k / month",
          aggressive: "HKD 45k-78k / month",
        },
        factorHintKey: "planLabCostHomePurchaseMonthlyFactor",
        factorHintFallback:
          "Driven by district premium, purchase price, down payment, and mortgage rate.",
      },
    ],
    availabilityGuard: () => ({ enabled: true }),
  },
  {
    id: "rental_plan",
    launcher: "bundle_housing",
    titleKey: "planLabDecisionTemplateRentalPlanTitle",
    titleFallback: "Rental plan",
    descriptionKey: "planLabDecisionTemplateRentalPlanDesc",
    descriptionFallback: "Use the rent housing flow with local rent ranges.",
    estimateGuideKey: "planLabDecisionTemplateRentalPlanGuide",
    estimateGuideFallback:
      "Ranges vary by district, floor area, tenancy term, and furnishing level.",
    costRangeItems: [
      {
        id: "rentalMonthly",
        labelKey: "planLabCostRentalPlanMonthly",
        labelFallback: "Monthly rent outflow",
        valueKeys: {
          conservative: "planLabCostRentalPlanMonthlyConservative",
          median: "planLabCostRentalPlanMonthlyMedian",
          aggressive: "planLabCostRentalPlanMonthlyAggressive",
        },
        valueFallbacks: {
          conservative: "HKD 12k-20k / month",
          median: "HKD 22k-36k / month",
          aggressive: "HKD 40k-65k / month",
        },
        factorHintKey: "planLabCostRentalPlanMonthlyFactor",
        factorHintFallback:
          "Driven by district premium, unit size, lease term, and furnishing needs.",
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
