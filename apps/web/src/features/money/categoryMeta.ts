import { expenseCategories, incomeSubtypes } from "../../domain/events/eventTaxonomy";
import type { ScenarioEvent } from "../../domain/scenarioV2/events";

export const UI_INCOME_CATEGORY_KEYS = [
  "salary",
  "bonus",
  "freelance",
  "rental",
  "dividend",
  "interest",
  "other",
] as const;

export const UI_EXPENSE_CATEGORY_KEYS = [
  "daily_living",
  "transport",
  "property_ownership",
  "vehicle_ownership",
  "insurance",
  "healthcare",
  "education",
  "family_support",
  "entertainment",
  "travel",
  "tax",
  "debt_repayment",
  "other",
] as const;

const incomeCategorySet = new Set<string>(UI_INCOME_CATEGORY_KEYS);
const expenseCategorySet = new Set<string>(UI_EXPENSE_CATEGORY_KEYS);

export const resolveEventCategoryKey = (event: ScenarioEvent): string | null => {
  if (event.type !== "cashflow") {
    return null;
  }
  if (event.kind === "income") {
    const key = event.category ?? "other";
    return incomeCategorySet.has(key) ? key : "other";
  }
  const key = event.expenseCategory ?? "other";
  return expenseCategorySet.has(key) ? key : "other";
};

export const assertMoneyCategoryUiContract = (): void => {
  if (UI_INCOME_CATEGORY_KEYS.join(",") !== incomeSubtypes.join(",")) {
    throw new Error("[taxonomy-contract] incomeSubtypes updated without money UI mapping update");
  }
  if (UI_EXPENSE_CATEGORY_KEYS.join(",") !== expenseCategories.join(",")) {
    throw new Error("[taxonomy-contract] expenseCategories updated without money UI mapping update");
  }
};
