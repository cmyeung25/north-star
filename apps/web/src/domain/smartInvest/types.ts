export type SmartInvestAllocation = {
  id: string;
  name: string;
  targetPct: number;
  assumedAnnualReturnPct: number;
};

export type SmartInvestAllocationProfile = {
  id: string;
  name: string;
  startMonth: string;
  allocation: SmartInvestAllocation[];
};

export type SmartInvestPolicy = {
  enabled: boolean;
  reserve:
    | { mode: "fixed"; amount: number }
    | { mode: "monthsOfOutflow"; months: number };
  contribution:
    | { mode: "percentOfIncome"; pct: number }
    | { mode: "percentOfSurplus"; pct: number }
    | { mode: "excessCash"; investPct: number; thresholdAmount: number }
    | { mode: "rebalance" };
  allocation: SmartInvestAllocation[];
  allocationProfiles?: SmartInvestAllocationProfile[];
  withdrawal: {
    enabled: boolean;
    mode: "sellToMaintainReserve";
    sellOrder: "proRata";
  };
};
