import { useMemo } from "react";
import { computeProjection, monthIndex } from "@north-star/engine";
import type { ProjectionResult } from "@north-star/engine";
import { mapScenarioToEngineInput, type AdapterWarning } from "./adapter";
import { compileScenarioCashflows } from "../domain/events/compiler";
import { getEventSign } from "../events/eventCatalog";
import { compileAllBudgetRules } from "../domain/budget/compileBudgetRules";
import type { BudgetRule, Scenario, ScenarioMember } from "../store/scenarioStore";
import type { EventDefinition } from "../domain/events/types";
import type { CashflowItem } from "../domain/ledger/types";
import { normalizeMonthStrict } from "../utils/month";
import {
  groupLedgerByMonth,
  summarizeMonth,
  type LedgerMonthSummary,
} from "../domain/ledger/ledgerUtils";
import { compileSellLifecycle } from "../domain/positions/compileSellLifecycle";
import {
  buildNetWorthBreakdownByMonth,
  type NetWorthBreakdown,
} from "../domain/netWorth/buildNetWorthBreakdown";

type ProjectionWithLedger = {
  projection: ProjectionResult | null;
  ledger: CashflowItem[];
  months: string[];
  ledgerByMonth: Record<string, CashflowItem[]>;
  summaryByMonth: Record<string, LedgerMonthSummary>;
  positionCashflowsByMonth: Record<string, CashflowItem[]>;
  projectionNetCashflowByMonth: Record<string, number>;
  projectionNetCashflowMode: "netCashflow" | "cashDelta";
  netWorthBreakdownByMonth: Record<string, NetWorthBreakdown>;
  projectionWarnings: AdapterWarning[];
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
  netWorthBreakdownByMonth: {},
  projectionWarnings: [],
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

const normalizeBudgetRulesForLedger = (rules: BudgetRule[]) =>
  rules.flatMap((rule) => {
    const startMonth = rule.startMonth
      ? normalizeMonthStrict(rule.startMonth)
      : null;
    if (rule.startMonth && !startMonth?.ok) {
      return [];
    }
    const endMonth = rule.endMonth ? normalizeMonthStrict(rule.endMonth) : null;
    if (rule.endMonth && !endMonth?.ok) {
      return [];
    }
    return [
      {
        ...rule,
        startMonth: startMonth?.ok ? startMonth.month : undefined,
        endMonth: endMonth?.ok ? endMonth.month : undefined,
      },
    ];
  });

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

const normalizePositionSourceId = (key: string) => {
  const sanitized = key
    .replace(/:down_payment$/, ":downPayment")
    .replace(/:fees_one_time$/, ":feesOneTime")
    .replace(/:holding_cost$/, ":holdingCost")
    .replace(/:mortgage_interest$/, ":mortgageInterest")
    .replace(/:mortgage_principal$/, ":mortgagePrincipal")
    .replace(/:rental_income$/, ":rentalIncome")
    .replace(/:loan_interest$/, ":loanInterest")
    .replace(/:loan_principal$/, ":loanPrincipal")
    .replace(/:interest$/, ":interest")
    .replace(/:principal$/, ":principal")
    .replace(/:premium$/, ":premium")
    .replace(/:contribution$/, ":contribution")
    .replace(/:withdrawal$/, ":withdrawal");
  const parts = sanitized.split(":");
  if (parts.length >= 3) {
    return `${parts[0]}:${parts[parts.length - 1]}`;
  }
  return sanitized;
};

const isPositionCashflowKey = (key: string) =>
  /^(home|car|loan|insurance|investment):/.test(key);

const buildPositionCashflowsByMonth = (
  projection: ProjectionResult,
  scenario: Scenario
) => {
  const entries: Array<{ month: string; amount: number; sourceId: string }> = [];
  const breakdown = projection.breakdown?.cashflow.byKey ?? {};
  const months = projection.months;

  Object.entries(breakdown).forEach(([key, series]) => {
    if (!isPositionCashflowKey(key)) {
      return;
    }
    const sourceId = normalizePositionSourceId(key);
    series.forEach((amount, index) => {
      if (!amount) {
        return;
      }
      const month = months[index];
      if (!month) {
        return;
      }
      entries.push({ month, amount, sourceId });
    });
  });

  compileSellLifecycle(scenario).forEach((entry) => {
    entries.push({ month: entry.month, amount: entry.amount, sourceId: entry.sourceId });
  });

  return entries.reduce<Record<string, CashflowItem[]>>((acc, entry) => {
    if (!acc[entry.month]) {
      acc[entry.month] = [];
    }
    acc[entry.month].push({
      month: entry.month,
      amount: entry.amount,
      source: "position",
      sourceId: normalizePositionSourceId(entry.sourceId),
    });
    return acc;
  }, {});
};

export const useProjectionWithLedger = (
  scenario: Scenario | null | undefined,
  eventLibrary: EventDefinition[],
  options: { members?: ScenarioMember[]; budgetRules?: BudgetRule[] } = {}
): ProjectionWithLedger =>
  useMemo(() => {
    if (!scenario) {
      return emptyProjectionWithLedger;
    }

    const { input, warnings } = mapScenarioToEngineInput(scenario, eventLibrary, {
      strict: false,
      members: options.members ?? [],
      budgetRules: options.budgetRules ?? [],
    });
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
    const members = options.members ?? [];
    const budgetRules = normalizeBudgetRulesForLedger(options.budgetRules ?? []);
    const budgetLedger = includeBudgetRulesInProjection
      ? compileAllBudgetRules(scenarioForLedger, budgetRules, members)
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
      scenarioForLedger
    );
    const netWorthBreakdownByMonth = buildNetWorthBreakdownByMonth(projection);

    return {
      projection,
      ledger,
      months: projection.months,
      ledgerByMonth,
      summaryByMonth,
      positionCashflowsByMonth,
      projectionNetCashflowByMonth: netCashflowLookup.byMonth,
      projectionNetCashflowMode: netCashflowLookup.mode,
      netWorthBreakdownByMonth,
      projectionWarnings: warnings,
    };
  }, [eventLibrary, options.budgetRules, options.members, scenario]);
