"use client";

import { useMemo } from "react";
import { useScenarioStore, getScenarioById } from "../../../src/store/scenarioStore";
import { useProjectionWithLedger } from "../../../src/engine/useProjectionWithLedger";
import { projectionToOverviewViewModel } from "../../../src/engine/adapter";
import type { TimeSeriesPoint } from "../../../features/overview/types";
import PlanLabPanel from "../../../features/planLab/PlanLabPanel";

export default function PlanLabClient() {
  const scenarios = useScenarioStore((state) => state.scenarios);
  const eventLibrary = useScenarioStore((state) => state.eventLibrary);
  const members = useScenarioStore((state) => state.members);
  const budgetRules = useScenarioStore((state) => state.budgetRules);
  const appSettings = useScenarioStore((state) => state.appSettings);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);

  const scenario = useMemo(
    () => getScenarioById(scenarios, activeScenarioId),
    [activeScenarioId, scenarios]
  );

  const projectionState = useProjectionWithLedger(scenario, eventLibrary, {
    members,
    budgetRules,
  });

  const overviewViewModel = useMemo(
    () =>
      projectionState.projection
        ? projectionToOverviewViewModel(projectionState.projection)
        : null,
    [projectionState.projection]
  );

  const inflationPct = appSettings.annualInflationPct ?? 0;
  const displayMode = appSettings.viewMode;
  const deflator = useMemo(
    () => (index: number) => Math.pow(1 + inflationPct / 100, index / 12),
    [inflationPct]
  );
  const deflateSeries = useMemo(
    () => (series: TimeSeriesPoint[]) =>
      series.map((entry, index) => ({
        ...entry,
        value: entry.value / deflator(index),
      })),
    [deflator]
  );

  const cashSeries = useMemo(() => {
    const base = overviewViewModel?.cashSeries ?? [];
    return displayMode === "real" ? deflateSeries(base) : base;
  }, [deflateSeries, displayMode, overviewViewModel]);

  const netWorthSeries = useMemo(() => {
    const base = overviewViewModel?.netWorthSeries ?? [];
    return displayMode === "real" ? deflateSeries(base) : base;
  }, [deflateSeries, displayMode, overviewViewModel]);

  const netCashflowSeries = useMemo(() => {
    const base = projectionState.months.map((month) => ({
      month,
      value: projectionState.projectionNetCashflowByMonth[month] ?? 0,
    }));
    return displayMode === "real" ? deflateSeries(base) : base;
  }, [deflateSeries, displayMode, projectionState.months, projectionState.projectionNetCashflowByMonth]);

  if (!scenario) {
    return null;
  }

  return (
    <PlanLabPanel
      scenario={scenario}
      eventLibrary={eventLibrary}
      members={members}
      budgetRules={budgetRules}
      displayMode={displayMode}
      deflateSeries={deflateSeries}
      baselineSeries={{
        cash: cashSeries,
        netWorth: netWorthSeries,
        netCashflow: netCashflowSeries,
      }}
    />
  );
}
