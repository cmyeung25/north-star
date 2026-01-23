"use client";

import { useEffect } from "react";
import ProjectionDetailsModal from "./ProjectionDetailsModal";
import { useUiStore } from "../src/store/uiStore";
import type { CashflowItem } from "../src/domain/ledger/types";
import type { LedgerMonthSummary } from "../src/domain/ledger/ledgerUtils";
import type { NetWorthBreakdown } from "../src/domain/netWorth/buildNetWorthBreakdown";

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
}: MonthlyBreakdownModalHostProps) {
  const activeModal = useUiStore((state) => state.activeModal);
  const breakdownOpen = useUiStore((state) => state.breakdownOpen);
  const breakdownMonth = useUiStore((state) => state.breakdownMonth);
  const closeModal = useUiStore((state) => state.closeModal);
  const setBreakdownMonth = useUiStore((state) => state.setBreakdownMonth);
  const resolvedMonth = activeModal?.month ?? breakdownMonth ?? months[0];
  const opened = activeModal?.type === "monthlyBreakdown" || breakdownOpen;
  const initialTab = activeModal?.focus === "networth" ? "netWorth" : "cashflow";

  useEffect(() => {
    if (!breakdownMonth && months.length > 0) {
      setBreakdownMonth(months[0]);
    }
  }, [breakdownMonth, months, setBreakdownMonth]);

  return (
    <ProjectionDetailsModal
      opened={opened}
      onClose={closeModal}
      months={months}
      currentMonth={resolvedMonth}
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
    />
  );
}
