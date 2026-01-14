# North Star Engine v0.2

This package provides deterministic cashflow projections and core KPIs for the North Star financial planner.

## Scope (v0.2)

**Supported**
- Monthly projections based on event series expansion.
- Net cashflow and rolling cash balance.
- Asset and liability balance tracking (currently housing + mortgage).
- Mortgage amortization schedules (fixed-rate, fully amortizing).
- KPIs: lowest monthly balance, runway months, net worth at year 5, and risk level.

**Not supported yet**
- Multiple assets or liabilities beyond housing + mortgage.
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
  positions?: {
    home?: {
      purchasePrice: number;
      annualAppreciation: number; // decimal (e.g. 0.03)
      purchaseMonth: string; // "YYYY-MM"
      downPayment: number;
      mortgage?: {
        principal: number;
        annualRate: number; // decimal
        termMonths: number;
      };
      feesOneTime?: number;
    };
  };
};
```

### Output

```ts
type ProjectionResult = {
  baseMonth: string;
  months: string[];
  netCashflow: number[];
  cashBalance: number[];
  assets: {
    housing: number[];
    total: number[];
  };
  liabilities: {
    mortgage: number[];
    total: number[];
  };
  netWorth: number[];
  lowestMonthlyBalance: { value: number; index: number; month: string };
  lowestNetWorth?: { value: number; index: number; month: string };
  runwayMonths: number;
  netWorthYear5: number;
  riskLevel: "Low" | "Medium" | "High";
};
```

### Accounting logic (v0.2)
- Mortgage payments reduce cash balance in full.
- The principal portion reduces the outstanding mortgage liability.
- The interest portion is a true cost and reduces net worth over time.
- Net worth is computed as: `cashBalance + assets.total - liabilities.total`.
