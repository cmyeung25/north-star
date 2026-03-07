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

type PlanLabDecisionTemplateContext = {
  hasEligibleIncomeEvent: boolean;
  translate: TranslateFn;
};

type PlanLabDecisionTemplateCatalogItem = PlanLabDecisionTemplateSpec & {
  titleKey: string;
  titleFallback: string;
  descriptionKey: string;
  descriptionFallback: string;
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

export const PLAN_LAB_DECISION_TEMPLATE_CATALOG: PlanLabDecisionTemplateCatalogItem[] = [
  {
    id: "home_purchase",
    launcher: "bundle_home_purchase",
    titleKey: "planLabDecisionTemplateHomeTitle",
    titleFallback: "Home purchase",
    descriptionKey: "planLabDecisionTemplateHomeDesc",
    descriptionFallback: "Use the home purchase bundle with experiment mode.",
    availabilityGuard: () => ({ enabled: true }),
  },
  {
    id: "new_baby",
    launcher: "bundle_new_baby",
    titleKey: "planLabDecisionTemplateBabyTitle",
    titleFallback: "New baby",
    descriptionKey: "planLabDecisionTemplateBabyDesc",
    descriptionFallback: "Use the new baby bundle with experiment mode.",
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
    return {
      id: item.id,
      launcher: item.launcher,
      title: context.translate(item.titleKey, item.titleFallback),
      description: context.translate(item.descriptionKey, item.descriptionFallback),
      availability,
      defaultPayload: item.defaultPayload,
    };
  });
