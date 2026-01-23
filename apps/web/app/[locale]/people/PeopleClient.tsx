"use client";

import { Stack } from "@mantine/core";
import { useEffect, useMemo } from "react";
import MonthlyBreakdownModalHost from "../../../components/MonthlyBreakdownModalHost";
import RightPaneDashboard from "../../../components/RightPaneDashboard";
import TwoPaneLayout from "../../../components/TwoPaneLayout";
import { useProjectionWithLedger } from "../../../src/engine/useProjectionWithLedger";
import {
  getScenarioById,
  resolveScenarioIdFromQuery,
  useScenarioStore,
} from "../../../src/store/scenarioStore";
import { useUiStore } from "../../../src/store/uiStore";
import SettingsClient from "../settings/SettingsClient";

type PeopleClientProps = {
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

export default function PeopleClient({
  scenarioId,
  initialTab,
  initialAdd,
  initialRuleId,
}: PeopleClientProps) {
  const scenarios = useScenarioStore((state) => state.scenarios);
  const eventLibrary = useScenarioStore((state) => state.eventLibrary);
  const members = useScenarioStore((state) => state.members);
  const budgetRules = useScenarioStore((state) => state.budgetRules);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const breakdownMonth = useUiStore((state) => state.breakdownMonth);
  const setBreakdownMonth = useUiStore((state) => state.setBreakdownMonth);
  const openModal = useUiStore((state) => state.openModal);
  const resolvedScenarioId = useMemo(
    () =>
      resolveScenarioIdFromQuery(scenarioId ?? null, activeScenarioId, scenarios),
    [activeScenarioId, scenarioId, scenarios]
  );
  const scenario = getScenarioById(scenarios, resolvedScenarioId);
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
  const selectedDashboardMonth = breakdownMonth ?? projectionMonths[0] ?? null;
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
    if (!breakdownMonth && projectionMonths.length > 0) {
      setBreakdownMonth(projectionMonths[0]);
    }
  }, [breakdownMonth, projectionMonths, setBreakdownMonth]);

  const defaultTab =
    initialTab && initialTab in tabMap
      ? tabMap[initialTab as keyof typeof tabMap]
      : "members";

  return (
    <Stack gap="xl">
      <TwoPaneLayout
        left={
          <SettingsClient
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
            selectedMonth={selectedDashboardMonth}
            months={projectionMonths}
            currency={scenario?.baseCurrency ?? "USD"}
            cashBalance={cashBalanceValue}
            netWorth={netWorthValue}
            netCashflow={netCashflowValue}
            cashSeries={cashSeries}
            netWorthSeries={netWorthSeries}
            netCashflowSeries={netCashflowSeries}
            onMonthChange={(month) => setBreakdownMonth(month)}
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
      />
    </Stack>
  );
}
