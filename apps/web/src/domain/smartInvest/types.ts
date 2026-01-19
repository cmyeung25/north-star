export type SmartInvestPolicy = {
  enabled: boolean;
  reserve:
    | { mode: "fixed"; amount: number }
    | { mode: "monthsOfOutflow"; months: number };
  contribution:
    | { mode: "percentOfIncome"; pct: number }
    | { mode: "percentOfSurplus"; pct: number };
  allocation: Array<{
    id: string;
    name: string;
    targetPct: number;
    assumedAnnualReturnPct: number;
  }>;
  withdrawal: {
    enabled: boolean;
    mode: "sellToMaintainReserve";
    sellOrder: "proRata";
  };
};
