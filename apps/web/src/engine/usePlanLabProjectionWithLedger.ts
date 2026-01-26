import { useMemo } from "react";
import type { ProjectionResult } from "@north-star/engine";
import { computeProjection } from "@north-star/engine";
import { mapScenarioToEngineInput, type AdapterWarning } from "./adapter";
import {
  buildNetWorthBreakdownByMonth,
  type NetWorthBreakdown,
} from "../domain/netWorth/buildNetWorthBreakdown";
import {
  buildSmartInvestProjectionBreakdown,
} from "../domain/smartInvest/projection";
import { compileAllBudgetRules } from "../domain/budget/compileBudgetRules";
import { compileScenarioCashflows } from "../domain/events/compiler";
import { getEventSign } from "../events/eventCatalog";
import type { EventDefinition, ScenarioEventRef } from "../domain/events/types";
import type { CashflowItem } from "../domain/ledger/types";
import {
  groupLedgerByMonth,
  summarizeMonth,
  type LedgerMonthSummary,
} from "../domain/ledger/ledgerUtils";
import { compilePlanLabDraft } from "../domain/planLab/compilePlanLabDraft";
import type { PlanLabDraft } from "../domain/planLab/types";
import type { BudgetRule, Scenario, ScenarioMember } from "../store/scenarioStore";
import {
  normalizeMonthStrict,
} from "../utils/month";
import { monthIndex } from "@north-star/engine";

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
  smartInvestTransferSeries: Array<{
    month: string;
    amount: number;
    kind: "contribution" | "withdrawal";
  }>;
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
  smartInvestTransferSeries: [],
};

const filterLedgerToHorizon = (
  ledger: CashflowItem[],
  baseMonth: string,
  horizonMonths: number
) =>
  ledger.flatMap((entry) => {
    const normalized = normalizeMonthStrict(entry.month);
    if (!normalized.ok) {
      return [];
    }
    const offset = monthIndex(baseMonth, normalized.month);
    if (offset < 0 || offset >= horizonMonths) {
      return [];
    }
    return [{ ...entry, month: normalized.month }];
  });

const compileEventLedger = (
  scenario: Scenario,
  eventLibrary: EventDefinition[],
  members: ScenarioMember[]
): CashflowItem[] => {
  const eventLookup = new Map(
    eventLibrary.map((definition) => [definition.id, definition])
  );
  const cashflows = compileScenarioCashflows({
    scenario,
    eventLibrary,
    signByType: getEventSign,
    members,
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

const buildPositionCashflowsByMonth = (projection: ProjectionResult) => {
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

const applyEventRefOverrides = (
  refs: ScenarioEventRef[] | undefined,
  overrides: ScenarioEventRef[]
) => {
  if (!refs || refs.length === 0 || overrides.length === 0) {
    return refs ?? [];
  }
  const overridesById = new Map(
    overrides.map((override) => [override.refId, override])
  );
  return refs.map((ref) => {
    const override = overridesById.get(ref.refId);
    if (!override) {
      return ref;
    }
    return {
      ...ref,
      enabled: override.enabled ?? ref.enabled,
      overrides: {
        ...(ref.overrides ?? {}),
        ...(override.overrides ?? {}),
      },
    };
  });
};

export const usePlanLabProjectionWithLedger = (
  draft: PlanLabDraft | null | undefined,
  scenario: Scenario | null | undefined,
  eventLibrary: EventDefinition[],
  options: { members?: ScenarioMember[]; budgetRules?: BudgetRule[] } = {}
): ProjectionWithLedger =>
  useMemo(() => {
    if (!draft && !scenario) {
      return emptyProjectionWithLedger;
    }

    const planLabCompilation = compilePlanLabDraft(draft, {
      baselineScenario: scenario ?? null,
      eventLibrary,
      budgetRules: options.budgetRules ?? [],
    });

    const eventRefsWithOverrides = applyEventRefOverrides(
      scenario?.eventRefs,
      planLabCompilation.eventRefOverrides
    );

    const baselineScenario: Scenario | null = scenario
      ? {
          ...scenario,
          assumptions: {
            ...scenario.assumptions,
            ...planLabCompilation.assumptions,
          },
          positions: {
            ...(scenario.positions ?? {}),
            ...planLabCompilation.positions,
          },
          eventRefs: [
            ...eventRefsWithOverrides,
            ...planLabCompilation.eventRefs,
          ],
        }
      : null;

    const combinedEventLibrary = [
      ...eventLibrary,
      ...planLabCompilation.eventDefinitions,
    ];

    if (!baselineScenario) {
      return emptyProjectionWithLedger;
    }

    const { input, warnings } = mapScenarioToEngineInput(
      baselineScenario,
      combinedEventLibrary,
      {
        strict: false,
        members: options.members ?? [],
        budgetRules: planLabCompilation.budgetRules ?? options.budgetRules ?? [],
      }
    );

    const computedProjection = computeProjection(input);

    const scenarioForLedger = {
      ...baselineScenario,
      assumptions: {
        ...baselineScenario.assumptions,
        baseMonth: input.baseMonth,
        horizonMonths: input.horizonMonths,
      },
      eventRefs: baselineScenario.eventRefs,
    };

    const includeBudgetRulesInProjection =
      scenarioForLedger.assumptions.includeBudgetRulesInProjection ?? true;
    const members = options.members ?? [];
    const eventLedger = compileEventLedger(
      scenarioForLedger,
      combinedEventLibrary,
      members
    );
    const budgetRules = normalizeBudgetRulesForLedger(
      planLabCompilation.budgetRules ?? options.budgetRules ?? []
    );
    const budgetLedger = includeBudgetRulesInProjection
      ? compileAllBudgetRules(scenarioForLedger, budgetRules, members)
      : [];
    const smartInvestLedger = computedProjection
      ? buildSmartInvestProjectionBreakdown(
          computedProjection,
          scenarioForLedger.assumptions.smartInvest?.allocation
        ).cashflowEntries.map((entry) => {
          const kind: CashflowItem["kind"] =
            entry.label === "withdrawal" ? "withdrawal" : "contribution";
          return {
            month: entry.month,
            amount: entry.amount,
            source: "smartInvest" as const,
            sourceId: entry.sourceId,
            label: entry.label,
            category: "smartInvest",
            bucketId: entry.bucketId,
            bucketName: entry.bucketName,
            kind,
          };
        })
      : [];
    const ledger = filterLedgerToHorizon(
      [...eventLedger, ...budgetLedger, ...smartInvestLedger],
      input.baseMonth,
      input.horizonMonths
    );
    const ledgerByMonth = groupLedgerByMonth(ledger);
    const summaryByMonth = computedProjection.months.reduce<
      Record<string, LedgerMonthSummary>
    >((acc, month) => {
      acc[month] = summarizeMonth(ledgerByMonth[month] ?? []);
      return acc;
    }, {});
    const netCashflowLookup = buildProjectionNetCashflowByMonth(
      computedProjection,
      input.initialCash ?? 0
    );
    const positionCashflowsByMonth = buildPositionCashflowsByMonth(
      computedProjection
    );
    const netWorthBreakdownByMonth =
      buildNetWorthBreakdownByMonth(computedProjection);

    return {
      projection: computedProjection,
      ledger,
      months: computedProjection.months,
      ledgerByMonth,
      summaryByMonth,
      positionCashflowsByMonth,
      projectionNetCashflowByMonth: netCashflowLookup.byMonth,
      projectionNetCashflowMode: netCashflowLookup.mode,
      netWorthBreakdownByMonth,
      projectionWarnings: [...warnings, ...planLabCompilation.warnings],
      smartInvestTransferSeries: [],
    };
  }, [draft, eventLibrary, options.budgetRules, options.members, scenario]);
