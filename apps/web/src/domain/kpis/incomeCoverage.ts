import type { CashflowItem } from "../ledger/types";

export const CORE_LIVING_EXPENSE_CATEGORIES = [
  "daily_living",
  "transport",
  "property_ownership",
  "vehicle_ownership",
  "insurance",
  "healthcare",
  "education",
  "family_support",
  "debt_repayment",
  "tax",
  // legacy / transitional category names
  "rent",
  "mortgage",
  "housing",
  "health",
  "childcare",
  "eldercare",
] as const;

const PASSIVE_INCOME_KEYWORDS = ["rental", "dividend", "interest"] as const;
const SALARY_KEYWORDS = ["salary"] as const;
const ASSET_LINKED_EXPENSE_CATEGORIES = [
  "property_ownership",
  "vehicle_ownership",
  "rent",
  "mortgage",
  "housing",
] as const;

const coreLivingExpenseCategorySet = new Set<string>(CORE_LIVING_EXPENSE_CATEGORIES);
const assetLinkedExpenseCategorySet = new Set<string>(ASSET_LINKED_EXPENSE_CATEGORIES);

const toSearchText = (item: CashflowItem) =>
  `${item.sourceId} ${item.label ?? ""} ${item.category ?? ""}`.toLowerCase();

const hasAnyKeyword = (text: string, keywords: readonly string[]) =>
  keywords.some((keyword) => text.includes(keyword));

const sumAmounts = (items: CashflowItem[], predicate: (item: CashflowItem) => boolean) =>
  items.reduce((sum, item) => (predicate(item) ? sum + item.amount : sum), 0);

const sumExpenseAbs = (items: CashflowItem[], predicate: (item: CashflowItem) => boolean) =>
  items.reduce((sum, item) => {
    if (!predicate(item) || item.amount >= 0) {
      return sum;
    }
    return sum + Math.abs(item.amount);
  }, 0);

export type IncomeCoverageRatios = {
  nonSalaryIncomeRatio: number | null;
  passiveIncomeCoverage: number | null;
  assetLinkedExpenseRatio: number | null;
};

export const computeIncomeCoverageRatios = (
  horizonMonths: string[],
  ledgerByMonth: Record<string, CashflowItem[]>
): IncomeCoverageRatios => {
  let totalIncome = 0;
  let nonSalaryIncome = 0;
  let passiveIncome = 0;
  let coreLivingExpense = 0;
  let assetLinkedExpense = 0;

  horizonMonths.forEach((month) => {
    const items = ledgerByMonth[month] ?? [];

    totalIncome += sumAmounts(items, (item) => item.amount > 0);
    nonSalaryIncome += sumAmounts(items, (item) => {
      if (item.amount <= 0) {
        return false;
      }
      return !hasAnyKeyword(toSearchText(item), SALARY_KEYWORDS);
    });
    passiveIncome += sumAmounts(items, (item) => {
      if (item.amount <= 0) {
        return false;
      }
      return hasAnyKeyword(toSearchText(item), PASSIVE_INCOME_KEYWORDS);
    });

    coreLivingExpense += sumExpenseAbs(items, (item) =>
      coreLivingExpenseCategorySet.has((item.category ?? "").toLowerCase())
    );
    assetLinkedExpense += sumExpenseAbs(items, (item) =>
      assetLinkedExpenseCategorySet.has((item.category ?? "").toLowerCase())
    );
  });

  return {
    nonSalaryIncomeRatio: totalIncome > 0 ? nonSalaryIncome / totalIncome : null,
    passiveIncomeCoverage: coreLivingExpense > 0 ? passiveIncome / coreLivingExpense : null,
    assetLinkedExpenseRatio: coreLivingExpense > 0 ? assetLinkedExpense / coreLivingExpense : null,
  };
};
