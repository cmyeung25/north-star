"use client";

import { useEffect, useMemo } from "react";
import ProjectionDetailsModal from "./ProjectionDetailsModal";
import { useUiStore } from "../src/store/uiStore";
import type { CashflowItem } from "../src/domain/ledger/types";
import type { LedgerMonthSummary } from "../src/domain/ledger/ledgerUtils";
import type { NetWorthBreakdown } from "../src/domain/netWorth/buildNetWorthBreakdown";
import { resolveMonthInList } from "../src/utils/month";
import type { ScenarioEventView } from "../src/domain/events/types";
import type { ScenarioMember } from "../src/store/scenarioStore";

type MonthlyBreakdownModalHostProps = {
  months: string[];
  ledgerByMonth: Record<string, CashflowItem[]>;
  summaryByMonth: Record<string, LedgerMonthSummary>;
  positionCashflowsByMonth?: Record<string, CashflowItem[]>;
  projectionNetCashflowByMonth?: Record<string, number>;
  projectionNetCashflowMode?: "netCashflow" | "cashDelta";
  netWorthByMonth?: Record<string, number>;
  netWorthBreakdownByMonth?: Record<string, NetWorthBreakdown>;
  currency: string;
  memberLookup?: Record<string, string>;
  scenarioId?: string;
  baseMonth?: string | null;
  horizonMonths?: number;
  members?: ScenarioMember[];
  eventViews?: ScenarioEventView[];
};

export default function MonthlyBreakdownModalHost({
  months,
  ledgerByMonth,
  summaryByMonth,
  positionCashflowsByMonth,
  projectionNetCashflowByMonth,
  projectionNetCashflowMode,
  netWorthByMonth,
  netWorthBreakdownByMonth,
  currency,
  memberLookup,
  scenarioId,
  baseMonth,
  horizonMonths,
  members,
  eventViews,
}: MonthlyBreakdownModalHostProps) {
  const activeModal = useUiStore((state) => state.activeModal);
  const breakdownOpen = useUiStore((state) => state.breakdownOpen);
  const breakdownMonth = useUiStore((state) => state.breakdownMonth);
  const closeModal = useUiStore((state) => state.closeModal);
  const setBreakdownMonth = useUiStore((state) => state.setBreakdownMonth);
  const resolvedMonth = useMemo(
    () => resolveMonthInList(months, activeModal?.month ?? breakdownMonth),
    [activeModal?.month, breakdownMonth, months]
  );
  const opened = activeModal?.type === "monthlyBreakdown" || breakdownOpen;
  const initialTab = activeModal?.focus === "networth" ? "netWorth" : "cashflow";

  useEffect(() => {
    if (!opened) {
      return;
    }
    if (resolvedMonth && resolvedMonth !== breakdownMonth) {
      setBreakdownMonth(resolvedMonth);
    }
  }, [breakdownMonth, opened, resolvedMonth, setBreakdownMonth]);

  return (
    <ProjectionDetailsModal
      opened={opened}
      onClose={closeModal}
      months={months}
      currentMonth={resolvedMonth ?? undefined}
      onMonthChange={(value) => {
        setBreakdownMonth(value);
      }}
      ledgerByMonth={ledgerByMonth}
      summaryByMonth={summaryByMonth}
      positionCashflowsByMonth={positionCashflowsByMonth}
      projectionNetCashflowByMonth={projectionNetCashflowByMonth}
      projectionNetCashflowMode={projectionNetCashflowMode}
      netWorthByMonth={netWorthByMonth}
      netWorthBreakdownByMonth={netWorthBreakdownByMonth}
      currency={currency}
      memberLookup={memberLookup}
      initialTab={initialTab}
      scenarioId={scenarioId}
      baseMonth={baseMonth}
      horizonMonths={horizonMonths}
      members={members}
      eventViews={eventViews}
    />
  );
}
