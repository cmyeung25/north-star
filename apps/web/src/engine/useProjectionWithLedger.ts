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
  projectionNetCashflowByMonth: Record<string, number>;
  projectionNetCashflowMode: "netCashflow" | "cashDelta";
};

const emptyProjectionWithLedger: ProjectionWithLedger = {
  projection: null,
  ledger: [],
  months: [],
  ledgerByMonth: {},
  summaryByMonth: {},
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

export const useProjectionWithLedger = (
  scenario: Scenario | null | undefined,
  eventLibrary: EventDefinition[]
): ProjectionWithLedger =>
  useMemo(() => {
    if (!scenario) {
      return emptyProjectionWithLedger;
    }

    const input = mapScenarioToEngineInput(scenario, eventLibrary, { strict: false });
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

    return {
      projection,
      ledger,
      months: projection.months,
      ledgerByMonth,
      summaryByMonth,
      projectionNetCashflowByMonth: netCashflowLookup.byMonth,
      projectionNetCashflowMode: netCashflowLookup.mode,
    };
  }, [eventLibrary, scenario]);
