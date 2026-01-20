import { nanoid } from "nanoid";
import type { SmartInvestPolicy } from "./types";

export const buildDefaultSmartInvestPolicy = (
  allocationName: string
): SmartInvestPolicy => ({
  enabled: false,
  reserve: { mode: "fixed", amount: 0 },
  contribution: { mode: "percentOfIncome", pct: 10 },
  allocation: [
    {
      id: nanoid(6),
      name: allocationName,
      targetPct: 100,
      assumedAnnualReturnPct: 5,
    },
  ],
  withdrawal: {
    enabled: false,
    mode: "sellToMaintainReserve",
    sellOrder: "proRata",
  },
});
