import type { ProjectionResult } from "@north-star/engine";

export type NetWorthBreakdownItem = {
  key: string;
  amount: number;
  kind: "asset" | "liability";
};

export type NetWorthBreakdown = {
  month: string;
  cash: number;
  assetsTotal: number;
  liabilitiesTotal: number;
  netWorth: number;
  assetCategories: {
    housing: number;
    investments: number;
    cars: number;
    insurance: number;
  };
  liabilityCategories: {
    mortgage: number;
    loans: number;
    auto: number;
  };
  allocation: {
    cashPct: number;
    housingPct: number;
    investmentsPct: number;
    carsPct: number;
    insurancePct: number;
  };
  items: NetWorthBreakdownItem[];
};

const safePct = (value: number, total: number) =>
  total > 0 ? (value / total) * 100 : 0;

export const buildNetWorthBreakdownByMonth = (
  projection: ProjectionResult
): Record<string, NetWorthBreakdown> => {
  const breakdown = projection.breakdown?.assets;
  const result: Record<string, NetWorthBreakdown> = {};

  projection.months.forEach((month, index) => {
    const cash = projection.cashBalance[index] ?? 0;
    const assetsTotal = projection.assets.total[index] ?? 0;
    const liabilitiesTotal = projection.liabilities.total[index] ?? 0;
    const netWorth = projection.netWorth[index] ?? 0;
    const assetCategories = {
      housing: projection.assets.housing[index] ?? 0,
      investments: projection.assets.investments[index] ?? 0,
      cars: projection.assets.cars[index] ?? 0,
      insurance: projection.assets.insurance[index] ?? 0,
    };
    const liabilityCategories = {
      mortgage: projection.liabilities.mortgage[index] ?? 0,
      loans: projection.liabilities.loans[index] ?? 0,
      auto: projection.liabilities.auto[index] ?? 0,
    };
    const totalAssetsWithCash = cash + assetsTotal;
    const allocation = {
      cashPct: safePct(cash, totalAssetsWithCash),
      housingPct: safePct(assetCategories.housing, totalAssetsWithCash),
      investmentsPct: safePct(assetCategories.investments, totalAssetsWithCash),
      carsPct: safePct(assetCategories.cars, totalAssetsWithCash),
      insurancePct: safePct(assetCategories.insurance, totalAssetsWithCash),
    };

    const items: NetWorthBreakdownItem[] = [];
    if (breakdown?.assetsByKey) {
      Object.entries(breakdown.assetsByKey).forEach(([key, series]) => {
        const amount = series[index] ?? 0;
        if (amount === 0) {
          return;
        }
        items.push({ key, amount, kind: "asset" });
      });
    }
    if (breakdown?.liabilitiesByKey) {
      Object.entries(breakdown.liabilitiesByKey).forEach(([key, series]) => {
        const amount = series[index] ?? 0;
        if (amount === 0) {
          return;
        }
        items.push({ key, amount, kind: "liability" });
      });
    }

    result[month] = {
      month,
      cash,
      assetsTotal,
      liabilitiesTotal,
      netWorth,
      assetCategories,
      liabilityCategories,
      allocation,
      items,
    };
  });

  return result;
};
