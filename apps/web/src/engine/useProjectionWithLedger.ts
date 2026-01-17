import { useMemo } from "react";
import { computeProjection, monthIndex } from "@north-star/engine";
import type { ProjectionResult } from "@north-star/engine";
import { mapScenarioToEngineInput } from "./adapter";
import { compileScenarioCashflows } from "../domain/events/compiler";
import { getEventSign } from "../events/eventCatalog";
import { compileAllBudgetRules } from "../domain/budget/compileBudgetRules";
import type { Scenario } from "../store/scenarioStore";
import type { EventDefinition } from "../domain/events/types";
import type { CashflowItem } from "../domain/ledger/types";
import {
  groupLedgerByMonth,
  summarizeMonth,
  type LedgerMonthSummary,
} from "../domain/ledger/ledgerUtils";

type ProjectionWithLedger = {
  projection: ProjectionResult | null;
  ledger: CashflowItem[];
  months: string[];
  ledgerByMonth: Record<string, CashflowItem[]>;
  summaryByMonth: Record<string, LedgerMonthSummary>;
  positionCashflowsByMonth: Record<string, CashflowItem[]>;
  projectionNetCashflowByMonth: Record<string, number>;
  projectionNetCashflowMode: "netCashflow" | "cashDelta";
};

const emptyProjectionWithLedger: ProjectionWithLedger = {
  projection: null,
  ledger: [],
  months: [],
  ledgerByMonth: {},
  summaryByMonth: {},
  positionCashflowsByMonth: {},
  projectionNetCashflowByMonth: {},
  projectionNetCashflowMode: "netCashflow",
};

const filterLedgerToHorizon = (
  ledger: CashflowItem[],
  baseMonth: string,
  horizonMonths: number
) =>
  ledger.filter((entry) => {
    const offset = monthIndex(baseMonth, entry.month);
    return offset >= 0 && offset < horizonMonths;
  });

const compileEventLedger = (
  scenario: Scenario,
  eventLibrary: EventDefinition[]
): CashflowItem[] => {
  const eventLookup = new Map(
    eventLibrary.map((definition) => [definition.id, definition])
  );
  const cashflows = compileScenarioCashflows({
    scenario,
    eventLibrary,
    signByType: getEventSign,
  });

  return cashflows.map((entry) => {
    const definition = eventLookup.get(entry.sourceEventId);
    return {
      month: entry.month,
      amount: entry.amountSigned,
      source: "event",
      sourceId: entry.sourceEventId,
      label: entry.title,
      category: entry.category,
      memberId: definition?.memberId,
    };
  });
};

const buildProjectionNetCashflowByMonth = (
  projection: ProjectionResult,
  initialCash: number
) => {
  if (projection.netCashflow.length > 0) {
    return {
      mode: "netCashflow" as const,
      byMonth: projection.months.reduce<Record<string, number>>(
        (acc, month, index) => {
          acc[month] = projection.netCashflow[index] ?? 0;
          return acc;
        },
        {}
      ),
    };
  }

  return {
    mode: "cashDelta" as const,
    byMonth: projection.months.reduce<Record<string, number>>(
      (acc, month, index) => {
        const current = projection.cashBalance[index] ?? 0;
        const previous =
          index === 0 ? initialCash : projection.cashBalance[index - 1] ?? 0;
        acc[month] = current - previous;
        return acc;
      },
      {}
    ),
  };
};

const buildPositionCashflowsByMonth = (
  projection: ProjectionResult,
  scenario: Scenario,
  summaryByMonth: Record<string, LedgerMonthSummary>,
  projectionNetCashflowByMonth: Record<string, number>
) => {
  const hasHomes =
    Boolean(scenario.positions?.home) || (scenario.positions?.homes?.length ?? 0) > 0;
  const hasCars = (scenario.positions?.cars?.length ?? 0) > 0;
  const hasInvestments = (scenario.positions?.investments?.length ?? 0) > 0;
  const hasLoans = (scenario.positions?.loans?.length ?? 0) > 0;

  const getDelta = (series: number[], index: number) => {
    if (index <= 0) {
      return series[index] ?? 0;
    }
    return (series[index] ?? 0) - (series[index - 1] ?? 0);
  };

  return projection.months.reduce<Record<string, CashflowItem[]>>(
    (acc, month, index) => {
      const summary = summaryByMonth[month];
      const projectionNetCashflow = projectionNetCashflowByMonth[month];
      const positionTotal =
        projectionNetCashflow !== undefined && summary
          ? projectionNetCashflow - summary.total
          : 0;

      if (!positionTotal) {
        acc[month] = [];
        return acc;
      }

      const housingDelta = getDelta(projection.assets.housing, index);
      const carsDelta = getDelta(projection.assets.cars, index);
      const investmentsDelta = getDelta(projection.assets.investments, index);
      const mortgageDelta = getDelta(projection.liabilities.mortgage, index);
      const autoDelta = getDelta(projection.liabilities.auto, index);
      const loansDelta = getDelta(projection.liabilities.loans, index);

      const homeWeight = hasHomes
        ? Math.abs(housingDelta) + Math.abs(mortgageDelta)
        : 0;
      const carWeight = hasCars ? Math.abs(carsDelta) + Math.abs(autoDelta) : 0;
      const investmentWeight = hasInvestments ? Math.abs(investmentsDelta) : 0;
      const loanWeight = hasLoans ? Math.abs(loansDelta) : 0;

      const totalWeight = homeWeight + carWeight + investmentWeight + loanWeight;
      if (!totalWeight) {
        acc[month] = [];
        return acc;
      }

      const splitAmount = (total: number, primary: number, secondary: number) => {
        const base = primary + secondary;
        if (base === 0) {
          const primaryFallback = total * 0.7;
          return [primaryFallback, total - primaryFallback];
        }
        const primaryAmount = total * (primary / base);
        return [primaryAmount, total - primaryAmount];
      };

      const items: CashflowItem[] = [];

      if (homeWeight > 0) {
        const homeTotal = positionTotal * (homeWeight / totalWeight);
        const [mortgageAmount, holdingAmount] = splitAmount(
          homeTotal,
          Math.abs(mortgageDelta),
          Math.abs(housingDelta)
        );
        items.push(
          {
            month,
            amount: mortgageAmount,
            source: "position",
            sourceId: "home:mortgage",
          },
          {
            month,
            amount: holdingAmount,
            source: "position",
            sourceId: "home:holding",
          }
        );
      }

      if (carWeight > 0) {
        const carTotal = positionTotal * (carWeight / totalWeight);
        const [loanAmount, holdingAmount] = splitAmount(
          carTotal,
          Math.abs(autoDelta),
          Math.abs(carsDelta)
        );
        items.push(
          {
            month,
            amount: loanAmount,
            source: "position",
            sourceId: "car:loan",
          },
          {
            month,
            amount: holdingAmount,
            source: "position",
            sourceId: "car:holding",
          }
        );
      }

      if (investmentWeight > 0) {
        const investmentTotal = positionTotal * (investmentWeight / totalWeight);
        items.push({
          month,
          amount: investmentTotal,
          source: "position",
          sourceId: "investment:contribution",
        });
      }

      if (loanWeight > 0) {
        const loanTotal = positionTotal * (loanWeight / totalWeight);
        items.push({
          month,
          amount: loanTotal,
          source: "position",
          sourceId: "loan:repayment",
        });
      }

      acc[month] = items;
      return acc;
    },
    {}
  );
};

export const useProjectionWithLedger = (
  scenario: Scenario | null | undefined,
  eventLibrary: EventDefinition[]
): ProjectionWithLedger =>
  useMemo(() => {
    if (!scenario) {
      return emptyProjectionWithLedger;
    }

    const { input } = mapScenarioToEngineInput(scenario, eventLibrary, { strict: false });
    const projection = computeProjection(input);
    const scenarioForLedger = {
      ...scenario,
      assumptions: {
        ...scenario.assumptions,
        baseMonth: input.baseMonth,
        horizonMonths: input.horizonMonths,
      },
    };
    const includeBudgetRulesInProjection =
      scenario.assumptions.includeBudgetRulesInProjection ?? true;
    const eventLedger = compileEventLedger(scenarioForLedger, eventLibrary);
    const budgetLedger = includeBudgetRulesInProjection
      ? compileAllBudgetRules(scenarioForLedger)
      : [];
    const ledger = filterLedgerToHorizon(
      [...eventLedger, ...budgetLedger],
      input.baseMonth,
      input.horizonMonths
    );
    const ledgerByMonth = groupLedgerByMonth(ledger);
    const summaryByMonth = projection.months.reduce<
      Record<string, LedgerMonthSummary>
    >((acc, month) => {
      acc[month] = summarizeMonth(ledgerByMonth[month] ?? []);
      return acc;
    }, {});
    const netCashflowLookup = buildProjectionNetCashflowByMonth(
      projection,
      input.initialCash ?? 0
    );

    const positionCashflowsByMonth = buildPositionCashflowsByMonth(
      projection,
      scenarioForLedger,
      summaryByMonth,
      netCashflowLookup.byMonth
    );

    return {
      projection,
      ledger,
      months: projection.months,
      ledgerByMonth,
      summaryByMonth,
      positionCashflowsByMonth,
      projectionNetCashflowByMonth: netCashflowLookup.byMonth,
      projectionNetCashflowMode: netCashflowLookup.mode,
    };
  }, [eventLibrary, scenario]);
