# North Star Engine v0.1

This package provides deterministic cashflow projections and core KPIs for the North Star financial planner.

## Scope (v0.1)

**Supported**
- Monthly projections based on event series expansion.
- Net cashflow and rolling cash balance.
- KPIs: lowest monthly balance, runway months, net worth at year 5, and risk level.

**Not supported yet**
- Assets/liabilities beyond cash balance.
- Mortgage amortization or debt schedules.
- FX/multi-currency handling.
- Advanced risk modeling or probabilistic forecasts.

## Assumptions
- Single base currency.
- `annualGrowthPct` is a decimal (e.g. `0.03` for 3%).
- `baseMonth` is required to keep projections deterministic.

## API

```ts
import { computeProjection, expandEventToSeries } from "@north-star/engine";

const result = computeProjection({
  baseMonth: "2025-01",
  horizonMonths: 24,
  initialCash: 10000,
  events: [
    {
      enabled: true,
      startMonth: "2025-01",
      endMonth: null,
      monthlyAmount: -1200,
      annualGrowthPct: 0.03,
    },
  ],
});
```

### Input

```ts
type ProjectionInput = {
  baseMonth: string; // "YYYY-MM"
  horizonMonths: number;
  initialCash?: number;
  events: Event[];
};
```

### Output

```ts
type ProjectionResult = {
  baseMonth: string;
  months: string[];
  netCashflow: number[];
  cashBalance: number[];
  lowestMonthlyBalance: { value: number; index: number; month: string };
  runwayMonths: number;
  netWorthYear5: number;
  riskLevel: "Low" | "Medium" | "High";
};
```
