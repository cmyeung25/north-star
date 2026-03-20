import type { ScenarioEvent, ScenarioEventDraft } from "../../../domain/scenarioV2/events";
import type { Scenario, ScenarioAsset } from "../../../store/scenarioStore";
import type { ScenarioDraftV3State } from "./types";

export type OnboardingGuardrailSeverity = "critical" | "warning" | "info";
export type OnboardingGuardrailCategory =
  | "key_missing"
  | "obvious_conflict"
  | "basic_inconsistency"
  | "potential_double_counting";

export type OnboardingGuardrailStepId = "household" | "income" | "expense" | "assets";
export type OnboardingGuardrailSection =
  | "housing"
  | "property"
  | "mortgage"
  | "fixedExpenses";

export type OnboardingGuardrailInput = {
  draft: ScenarioDraftV3State;
  scenario?: Pick<Scenario, "assets" | "events"> | null;
};

export type OnboardingGuardrailTarget = {
  stepId: OnboardingGuardrailStepId;
  section: OnboardingGuardrailSection;
};

export type OnboardingGuardrailSummaryLevel = "clear" | "warning" | "critical";

export type OnboardingGuardrailItem = {
  id: string;
  severity: OnboardingGuardrailSeverity;
  category: OnboardingGuardrailCategory;
  messageKey: string;
  actionHintKey: string;
  target: OnboardingGuardrailTarget;
  evidence: Record<string, number | boolean | string>;
};

export type OnboardingGuardrailSummary = {
  titleKey: string;
  level: OnboardingGuardrailSummaryLevel;
  levelKey: string;
  counts: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  categories: Record<OnboardingGuardrailCategory, number>;
  items: OnboardingGuardrailItem[];
};

type CashflowLikeEvent = Extract<ScenarioEvent | ScenarioEventDraft, { type: "cashflow" }>;

type PropertyLikeAsset = {
  id: string;
  kind?: ScenarioAsset["kind"];
  currentValue?: number;
  startMonth?: string;
  assetType?: string;
  usage?: string;
  rentMonthly?: number;
  mortgagePrincipalOutstanding?: number;
  mortgageAnnualInterestRatePct?: number;
  mortgageTermYears?: number;
  mortgageTermMonths?: number;
  holdingCostMonthly?: number;
};

type OnboardingGuardrailContext = {
  propertyAssets: PropertyLikeAsset[];
  rentExpenseEvents: CashflowLikeEvent[];
};

type OnboardingGuardrailDefinition = {
  id: string;
  severity: OnboardingGuardrailSeverity;
  category: OnboardingGuardrailCategory;
  blocksSubmission: boolean;
  messageKey: string;
  actionHintKey: string;
  target: OnboardingGuardrailTarget;
  evaluate: (context: OnboardingGuardrailContext) => OnboardingGuardrailItem | null;
};

const TITLE_KEY = "guardrails.title";
const severityRank: Record<OnboardingGuardrailSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const isFinitePositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isCashflowEvent = (
  event: ScenarioEvent | ScenarioEventDraft
): event is CashflowLikeEvent => event.type === "cashflow";

const isRecurringCadence = (value: CashflowLikeEvent["cadence"]) =>
  value === "monthly" || value === "quarterly" || value === "yearly" || value === "everyNMonths";

const isRentExpenseEvent = (
  event: ScenarioEvent | ScenarioEventDraft
): event is CashflowLikeEvent =>
  isCashflowEvent(event) &&
  event.kind === "expense" &&
  isFinitePositiveNumber(event.amount) &&
  isRecurringCadence(event.cadence) &&
  (event.growthSource === "rentGrowth" ||
    event.tags?.includes("onboarding:v3:expense:rent") === true);

const isPropertyLikeAsset = (
  asset: ScenarioAsset | ScenarioDraftV3State["assets"][number]
): boolean =>
  ("assetType" in asset && asset.assetType
    ? asset.assetType === "property"
    : asset.kind === "home");

const hasPropertySignal = (asset: PropertyLikeAsset) =>
  isFinitePositiveNumber(asset.currentValue) ||
  isFinitePositiveNumber(asset.mortgagePrincipalOutstanding) ||
  isFinitePositiveNumber(asset.rentMonthly);

const countMissingMortgageFields = (asset: PropertyLikeAsset) => {
  let missingFieldCount = 0;
  if (!isFinitePositiveNumber(asset.mortgageAnnualInterestRatePct)) {
    missingFieldCount += 1;
  }
  if (
    !isFinitePositiveNumber(asset.mortgageTermYears) &&
    !isFinitePositiveNumber(asset.mortgageTermMonths)
  ) {
    missingFieldCount += 1;
  }
  return missingFieldCount;
};

const buildItem = (
  definition: Omit<OnboardingGuardrailDefinition, "evaluate">,
  evidence: OnboardingGuardrailItem["evidence"]
): OnboardingGuardrailItem => ({
  id: definition.id,
  severity: definition.severity,
  category: definition.category,
  messageKey: definition.messageKey,
  actionHintKey: definition.actionHintKey,
  target: definition.target,
  evidence,
});

const defineRule = (
  definition: Omit<OnboardingGuardrailDefinition, "evaluate">,
  evaluate: OnboardingGuardrailDefinition["evaluate"]
): OnboardingGuardrailDefinition => ({
  ...definition,
  evaluate,
});

const propertyUsageMissingMeta = {
  id: "property_usage_missing",
  severity: "warning",
  category: "key_missing",
  blocksSubmission: false,
  messageKey: "guardrails.rules.propertyUsageMissing.message",
  actionHintKey: "guardrails.rules.propertyUsageMissing.action",
  target: { stepId: "assets", section: "property" },
} as const satisfies Omit<OnboardingGuardrailDefinition, "evaluate">;

const propertyUsageMissingRule = defineRule(
  propertyUsageMissingMeta,
  (context) => {
      const missingUsageCount = context.propertyAssets.filter(
        (asset) => hasPropertySignal(asset) && asset.usage !== "self" && asset.usage !== "rent"
      ).length;

      if (missingUsageCount === 0) {
        return null;
      }

      return buildItem(propertyUsageMissingMeta, { propertyCount: missingUsageCount });
    }
);

const mortgageCoreFieldsMissingMeta = {
  id: "mortgage_core_fields_missing",
  severity: "critical",
  category: "key_missing",
  blocksSubmission: true,
  messageKey: "guardrails.rules.mortgageCoreFieldsMissing.message",
  actionHintKey: "guardrails.rules.mortgageCoreFieldsMissing.action",
  target: { stepId: "assets", section: "mortgage" },
} as const satisfies Omit<OnboardingGuardrailDefinition, "evaluate">;

const mortgageCoreFieldsMissingRule = defineRule(
  mortgageCoreFieldsMissingMeta,
  (context) => {
      const affectedAssets = context.propertyAssets.filter((asset) =>
        isFinitePositiveNumber(asset.mortgagePrincipalOutstanding)
      );
      const missingFieldCount = affectedAssets.reduce(
        (total, asset) => total + countMissingMortgageFields(asset),
        0
      );

      if (missingFieldCount === 0) {
        return null;
      }

      return buildItem(mortgageCoreFieldsMissingMeta, {
        propertyCount: affectedAssets.filter((asset) => countMissingMortgageFields(asset) > 0)
          .length,
        missingFieldCount,
      });
    }
);

const selfUseRentalConflictMeta = {
  id: "self_use_rental_conflict",
  severity: "critical",
  category: "obvious_conflict",
  blocksSubmission: true,
  messageKey: "guardrails.rules.selfUseRentalConflict.message",
  actionHintKey: "guardrails.rules.selfUseRentalConflict.action",
  target: { stepId: "assets", section: "housing" },
} as const satisfies Omit<OnboardingGuardrailDefinition, "evaluate">;

const selfUseRentalConflictRule = defineRule(
  selfUseRentalConflictMeta,
  (context) => {
      const conflictCount = context.propertyAssets.filter(
        (asset) => asset.usage === "self" && isFinitePositiveNumber(asset.rentMonthly)
      ).length;

      if (conflictCount === 0) {
        return null;
      }

      return buildItem(selfUseRentalConflictMeta, { propertyCount: conflictCount });
    }
);

const rentalPropertyIncomeMissingMeta = {
  id: "rental_property_income_missing",
  severity: "warning",
  category: "basic_inconsistency",
  blocksSubmission: false,
  messageKey: "guardrails.rules.rentalPropertyIncomeMissing.message",
  actionHintKey: "guardrails.rules.rentalPropertyIncomeMissing.action",
  target: { stepId: "assets", section: "property" },
} as const satisfies Omit<OnboardingGuardrailDefinition, "evaluate">;

const rentalPropertyIncomeMissingRule = defineRule(
  rentalPropertyIncomeMissingMeta,
  (context) => {
      const missingIncomeCount = context.propertyAssets.filter(
        (asset) => asset.usage === "rent" && !isFinitePositiveNumber(asset.rentMonthly)
      ).length;

      if (missingIncomeCount === 0) {
        return null;
      }

      return buildItem(rentalPropertyIncomeMissingMeta, { propertyCount: missingIncomeCount });
    }
);

const mortgagePropertyBasicsMissingMeta = {
  id: "mortgage_property_basics_missing",
  severity: "warning",
  category: "basic_inconsistency",
  blocksSubmission: false,
  messageKey: "guardrails.rules.mortgagePropertyBasicsMissing.message",
  actionHintKey: "guardrails.rules.mortgagePropertyBasicsMissing.action",
  target: { stepId: "assets", section: "mortgage" },
} as const satisfies Omit<OnboardingGuardrailDefinition, "evaluate">;

const mortgagePropertyBasicsMissingRule = defineRule(
  mortgagePropertyBasicsMissingMeta,
  (context) => {
      const affectedCount = context.propertyAssets.filter(
        (asset) =>
          isFinitePositiveNumber(asset.mortgagePrincipalOutstanding) &&
          (!isFinitePositiveNumber(asset.currentValue) || !isNonEmptyString(asset.startMonth))
      ).length;

      if (affectedCount === 0) {
        return null;
      }

      return buildItem(mortgagePropertyBasicsMissingMeta, { propertyCount: affectedCount });
    }
);

const duplicateCurrentHomeHousingCostsMeta = {
  id: "duplicate_current_home_housing_costs",
  severity: "warning",
  category: "potential_double_counting",
  blocksSubmission: false,
  messageKey: "guardrails.rules.duplicateCurrentHomeHousingCosts.message",
  actionHintKey: "guardrails.rules.duplicateCurrentHomeHousingCosts.action",
  target: { stepId: "expense", section: "fixedExpenses" },
} as const satisfies Omit<OnboardingGuardrailDefinition, "evaluate">;

const duplicateCurrentHomeHousingCostsRule = defineRule(
  duplicateCurrentHomeHousingCostsMeta,
  (context) => {
      const selfUsePropertyCount = context.propertyAssets.filter(
        (asset) => asset.usage === "self"
      ).length;

      if (selfUsePropertyCount === 0 || context.rentExpenseEvents.length === 0) {
        return null;
      }

      return buildItem(duplicateCurrentHomeHousingCostsMeta, {
        selfUsePropertyCount,
        rentExpenseCount: context.rentExpenseEvents.length,
      });
    }
);

const duplicateRentExpenseInputsMeta = {
  id: "duplicate_rent_expense_inputs",
  severity: "info",
  category: "potential_double_counting",
  blocksSubmission: false,
  messageKey: "guardrails.rules.duplicateRentExpenseInputs.message",
  actionHintKey: "guardrails.rules.duplicateRentExpenseInputs.action",
  target: { stepId: "expense", section: "housing" },
} as const satisfies Omit<OnboardingGuardrailDefinition, "evaluate">;

const duplicateRentExpenseInputsRule = defineRule(
  duplicateRentExpenseInputsMeta,
  (context) => {
      if (context.rentExpenseEvents.length <= 1) {
        return null;
      }

      return buildItem(duplicateRentExpenseInputsMeta, {
        rentExpenseCount: context.rentExpenseEvents.length,
      });
    }
);

const RULE_DEFINITIONS: OnboardingGuardrailDefinition[] = [
  propertyUsageMissingRule,
  mortgageCoreFieldsMissingRule,
  selfUseRentalConflictRule,
  rentalPropertyIncomeMissingRule,
  mortgagePropertyBasicsMissingRule,
  duplicateCurrentHomeHousingCostsRule,
  duplicateRentExpenseInputsRule,
];

export const ONBOARDING_GUARDRAIL_RULES = RULE_DEFINITIONS.map((definition) => {
  const { evaluate, ...rule } = definition;
  void evaluate;
  return rule;
});

export function buildOnboardingGuardrailSummary({
  draft,
  scenario,
}: OnboardingGuardrailInput): OnboardingGuardrailSummary {
  const assets = draft.assets.length > 0 ? draft.assets : (scenario?.assets ?? []);
  const events = [...draft.events, ...(scenario?.events ?? [])];

  const context: OnboardingGuardrailContext = {
    propertyAssets: assets.filter(isPropertyLikeAsset) as PropertyLikeAsset[],
    rentExpenseEvents: events.filter(isRentExpenseEvent),
  };

  const items = RULE_DEFINITIONS.map((definition) => definition.evaluate(context))
    .filter((item): item is OnboardingGuardrailItem => item !== null)
    .sort(
      (left, right) =>
        severityRank[left.severity] - severityRank[right.severity] ||
        left.id.localeCompare(right.id)
    );

  const counts = items.reduce(
    (accumulator, item) => {
      accumulator.total += 1;
      accumulator[item.severity] += 1;
      return accumulator;
    },
    { total: 0, critical: 0, warning: 0, info: 0 }
  );

  const categories = items.reduce(
    (accumulator, item) => {
      accumulator[item.category] += 1;
      return accumulator;
    },
    {
      key_missing: 0,
      obvious_conflict: 0,
      basic_inconsistency: 0,
      potential_double_counting: 0,
    } satisfies Record<OnboardingGuardrailCategory, number>
  );

  const hasBlockingGuardrail = items.some((item) =>
    RULE_DEFINITIONS.some(
      (definition) => definition.id === item.id && definition.blocksSubmission
    )
  );

  const level: OnboardingGuardrailSummaryLevel =
    hasBlockingGuardrail ? "critical" : counts.warning > 0 ? "warning" : "clear";

  return {
    titleKey: TITLE_KEY,
    level,
    levelKey: `guardrails.level.${level}`,
    counts,
    categories,
    items,
  };
}
