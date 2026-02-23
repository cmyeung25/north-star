"use client";

import { Stack } from "@mantine/core";
import { useEffect, useMemo } from "react";
import MonthlyBreakdownModalHost from "../MonthlyBreakdownModalHost";
import RightPaneDashboard from "../RightPaneDashboard";
import TwoPaneLayout from "../TwoPaneLayout";
import { monthsBetween } from "../../src/domain/members/age";
import { buildScenarioEventViews } from "../../src/domain/events/utils";
import { useProjectionWithLedger } from "../../src/engine/useProjectionWithLedger";
import {
  getScenarioById,
  resolveScenarioIdFromQuery,
  useScenarioStore,
} from "../../src/store/scenarioStore";
import { useUiStore } from "../../src/store/uiStore";
import ScenarioSettingsWorkspace from "../settings/ScenarioSettingsWorkspace";

type PeopleWorkspaceProps = {
  scenarioId?: string;
  initialTab?: string;
  initialAdd?: string;
  initialRuleId?: string;
};

const tabMap = {
  assumptions: "global",
  members: "members",
  budget: "budget",
  settings: "data",
} as const;

export default function PeopleWorkspace({
  scenarioId,
  initialTab,
  initialAdd,
  initialRuleId,
}: PeopleWorkspaceProps) {
  const scenarios = useScenarioStore((state) => state.scenarios);
  const eventLibrary = useScenarioStore((state) => state.eventLibrary);
  const members = useScenarioStore((state) => state.members);
  const budgetRules = useScenarioStore((state) => state.budgetRules);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const breakdownMonth = useUiStore((state) => state.breakdownMonth);
  const setBreakdownMonth = useUiStore((state) => state.setBreakdownMonth);
  const breakdownMonthRange = useUiStore((state) => state.breakdownMonthRange);
  const setBreakdownMonthRange = useUiStore((state) => state.setBreakdownMonthRange);
  const openModal = useUiStore((state) => state.openModal);
  const resolvedScenarioId = useMemo(
    () =>
      resolveScenarioIdFromQuery(scenarioId ?? null, activeScenarioId, scenarios),
    [activeScenarioId, scenarioId, scenarios]
  );
  const scenario = getScenarioById(scenarios, resolvedScenarioId);
  const scenarioEventViews = useMemo(
    () => (scenario ? buildScenarioEventViews(scenario, eventLibrary) : []),
    [eventLibrary, scenario]
  );
  const {
    projection,
    months,
    ledgerByMonth,
    summaryByMonth,
    positionCashflowsByMonth,
    projectionNetCashflowByMonth,
    projectionNetCashflowMode,
    netWorthBreakdownByMonth,
  } = useProjectionWithLedger(scenario, eventLibrary, { members, budgetRules });
  const projectionMonths = useMemo(() => projection?.months ?? [], [projection]);
  const cashSeries = useMemo(() => projection?.cashBalance ?? [], [projection]);
  const netWorthSeries = useMemo(() => projection?.netWorth ?? [], [projection]);
  const netCashflowSeries = useMemo(
    () =>
      projectionMonths.map((month) =>
        (ledgerByMonth[month] ?? []).reduce((total, item) => total + item.amount, 0)
      ),
    [ledgerByMonth, projectionMonths]
  );
  const memberLookupRecord = useMemo(
    () =>
      Object.fromEntries(members.map((member) => [member.id, member.name])),
    [members]
  );
  const netWorthByMonth = useMemo(() => {
    if (!projection) {
      return {};
    }
    return projection.months.reduce<Record<string, number>>((acc, month, index) => {
      acc[month] = projection.netWorth[index] ?? 0;
      return acc;
    }, {});
  }, [projection]);
  const normalizedRange = useMemo(() => {
    if (projectionMonths.length === 0) {
      return { fromMonth: null, toMonth: null };
    }
    const baseMonth = projectionMonths[0];
    const clampMonth = (value: string | null, fallback: string) => {
      const index = monthsBetween(baseMonth, value ?? fallback);
      const clampedIndex = Math.min(Math.max(index, 0), projectionMonths.length - 1);
      return projectionMonths[clampedIndex];
    };
    const fallback = breakdownMonth ?? baseMonth;
    const fromMonth = clampMonth(breakdownMonthRange.fromMonth ?? fallback, baseMonth);
    let toMonth = clampMonth(breakdownMonthRange.toMonth ?? fromMonth, fromMonth);
    if (monthsBetween(fromMonth, toMonth) < 0) {
      toMonth = fromMonth;
    }
    return { fromMonth, toMonth };
  }, [breakdownMonth, breakdownMonthRange, projectionMonths]);
  const selectedDashboardMonth = normalizedRange.toMonth ?? projectionMonths[0] ?? null;
  const selectedDashboardIndex =
    selectedDashboardMonth && projectionMonths.includes(selectedDashboardMonth)
      ? projectionMonths.indexOf(selectedDashboardMonth)
      : 0;
  const cashBalanceValue = projection
    ? projection.cashBalance[selectedDashboardIndex] ?? null
    : null;
  const netWorthValue = projection
    ? projection.netWorth[selectedDashboardIndex] ?? null
    : null;
  const netCashflowValue = useMemo(() => {
    if (!selectedDashboardMonth) {
      return null;
    }
    const items = ledgerByMonth[selectedDashboardMonth] ?? [];
    return items.reduce((total, item) => total + item.amount, 0);
  }, [ledgerByMonth, selectedDashboardMonth]);

  useEffect(() => {
    if (projectionMonths.length === 0) {
      if (breakdownMonth !== null) {
        setBreakdownMonth(null);
      }
      if (breakdownMonthRange.fromMonth || breakdownMonthRange.toMonth) {
        setBreakdownMonthRange({ fromMonth: null, toMonth: null });
      }
      return;
    }
    if (
      normalizedRange.fromMonth !== breakdownMonthRange.fromMonth ||
      normalizedRange.toMonth !== breakdownMonthRange.toMonth
    ) {
      setBreakdownMonthRange(normalizedRange);
    }
    if (normalizedRange.toMonth !== breakdownMonth) {
      setBreakdownMonth(normalizedRange.toMonth);
    }
  }, [
    breakdownMonth,
    breakdownMonthRange,
    normalizedRange,
    projectionMonths.length,
    setBreakdownMonth,
    setBreakdownMonthRange,
  ]);

  const defaultTab =
    initialTab && initialTab in tabMap
      ? tabMap[initialTab as keyof typeof tabMap]
      : "members";

  return (
    <Stack gap="xl">
      <TwoPaneLayout
        left={
          <ScenarioSettingsWorkspace
            scenarioId={scenarioId}
            titleKey="peopleTitle"
            subtitleKey="peopleSubtitle"
            defaultTab={defaultTab}
            tabOrder={["global", "members", "budget", "data", "other"]}
            initialAction={initialAdd}
            initialRuleId={initialRuleId}
          />
        }
        right={
          <RightPaneDashboard
            months={projectionMonths}
            selectedRange={normalizedRange}
            currency={scenario?.baseCurrency ?? "USD"}
            cashBalance={cashBalanceValue}
            netWorth={netWorthValue}
            netCashflow={netCashflowValue}
            cashSeries={cashSeries}
            netWorthSeries={netWorthSeries}
            netCashflowSeries={netCashflowSeries}
            onRangeChange={(range) => {
              setBreakdownMonthRange(range);
              setBreakdownMonth(range.toMonth ?? null);
            }}
            onOpenBreakdown={(focus) => {
              if (!selectedDashboardMonth) {
                return;
              }
              openModal("monthlyBreakdown", {
                month: selectedDashboardMonth,
                focus,
              });
            }}
          />
        }
      />
      <MonthlyBreakdownModalHost
        months={months}
        ledgerByMonth={ledgerByMonth}
        summaryByMonth={summaryByMonth}
        positionCashflowsByMonth={positionCashflowsByMonth}
        projectionNetCashflowByMonth={projectionNetCashflowByMonth}
        projectionNetCashflowMode={projectionNetCashflowMode}
        netWorthByMonth={netWorthByMonth}
        netWorthBreakdownByMonth={netWorthBreakdownByMonth}
        currency={scenario?.baseCurrency ?? "USD"}
        memberLookup={memberLookupRecord}
        scenarioId={scenario?.id}
        baseMonth={scenario?.assumptions.baseMonth}
        horizonMonths={scenario?.assumptions.horizonMonths}
        members={members}
        eventViews={scenarioEventViews}
      />
    </Stack>
  );
}
