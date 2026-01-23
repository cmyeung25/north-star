import type { CashflowItem } from "./types";

const investmentCategories = new Set(["investment_contribution", "investment_withdrawal"]);
const investmentSourceIdPattern = /^investment:(contribution|withdrawal)\b/;

export const isInvestmentCashflow = (item: CashflowItem): boolean => {
  if (item.source === "smartInvest") {
    return true;
  }

  if (item.source === "position" && item.sourceId) {
    return investmentSourceIdPattern.test(item.sourceId);
  }

  if (item.sourceId && investmentSourceIdPattern.test(item.sourceId)) {
    return true;
  }

  const category = item.category?.toLowerCase();
  if (category && investmentCategories.has(category)) {
    return true;
  }

  return false;
};
