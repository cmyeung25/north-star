import { addMonths } from "@north-star/engine";
import type { ScenarioEvent, CashflowEvent } from "../scenarioV2/events";

export type EventOverrideChanges = {
  amountDelta?: number;
  amountMultiplier?: number;
  amountSet?: number;
  startMonthShift?: number;
  startMonth?: string;
  endMonthShift?: number;
  setEndMonth?: string | null;
  endMonth?: string | null;
  growthMode?: "none" | "assumption" | "custom";
  growthRate?: number;
};

export type EventOverrideExperimentSpec = {
  id: string;
  title: string;
  type: "event_override";
  targetEventId: string;
  changes: EventOverrideChanges;
  uiMetadata?: {
    startTimingMode?: "offset" | "month" | "age";
    endTimingMode?: "offset" | "month" | "age";
    startAgeYears?: number;
    startAgeMonths?: number;
    endAgeYears?: number;
    endAgeMonths?: number;
  };
};

const clampAmount = (value: number) => Math.max(0, Math.round(value));

const applyAmountOverride = (baseAmount: number, changes: EventOverrideChanges) => {
  if (typeof changes.amountSet === "number") {
    return clampAmount(changes.amountSet);
  }
  if (typeof changes.amountMultiplier === "number") {
    return clampAmount(baseAmount * changes.amountMultiplier);
  }
  if (typeof changes.amountDelta === "number") {
    return clampAmount(baseAmount + changes.amountDelta);
  }
  return undefined;
};

const applyMonthShift = (
  baseMonth: string | undefined,
  directValue: string | null | undefined,
  shift: number | undefined
): string | null | undefined => {
  if (directValue !== undefined) {
    return directValue;
  }
  if (typeof shift === "number" && baseMonth) {
    return addMonths(baseMonth, shift);
  }
  return undefined;
};

export const buildEventOverridePatch = (
  event: ScenarioEvent,
  spec: EventOverrideExperimentSpec
): Partial<ScenarioEvent> => {

  console.log(event, spec);

  if (event.id !== spec.targetEventId) {
    return {};
  }

  // Only support overrides for cashflow and housing events
  if (event.type !== "cashflow" && event.type !== "housing") {
    return {};
  }

  const patch: Partial<CashflowEvent | ScenarioEvent> = {};

  // Apply amount overrides only for cashflow events
  if (event.type === "cashflow") {
    const amount = applyAmountOverride((event as CashflowEvent).amount, spec.changes);
    if (typeof amount === "number") {
      (patch as Partial<CashflowEvent>).amount = amount;
    }
  }

  const nextStartMonth = applyMonthShift(
    event.startMonth,
    spec.changes.startMonth,
    spec.changes.startMonthShift
  );
  if (nextStartMonth !== undefined) {
    (patch as Partial<CashflowEvent>).startMonth = nextStartMonth ?? undefined;
  }

  const nextEndMonth = applyMonthShift(
    event.endMonth,
    spec.changes.setEndMonth ?? spec.changes.endMonth,
    spec.changes.endMonthShift
  );
  if (nextEndMonth !== undefined) {
    (patch as Partial<CashflowEvent>).endMonth = nextEndMonth ?? undefined;
  }

  // Apply growth mode overrides only for cashflow events
  if (event.type === "cashflow" && spec.changes.growthMode) {
    (patch as Partial<CashflowEvent>).growthMode = spec.changes.growthMode;
    (patch as Partial<CashflowEvent>).customGrowthRatePct =
      spec.changes.growthMode === "custom" ? spec.changes.growthRate ?? 0 : undefined;
  }

  return patch;
};

export const buildEventOverrideSummary = (
  event: ScenarioEvent,
  spec: EventOverrideExperimentSpec
): string[] => {
  const lines: string[] = [];
  if (event.type !== "cashflow") {
    return lines;
  }
  if (typeof spec.changes.amountSet === "number") {
    lines.push(`金額設定為 ${spec.changes.amountSet}`);
  } else if (typeof spec.changes.amountMultiplier === "number") {
    const pct = Math.round((spec.changes.amountMultiplier - 1) * 100);
    lines.push(`金額 ${pct >= 0 ? "+" : ""}${pct}%`);
  } else if (typeof spec.changes.amountDelta === "number") {
    lines.push(`金額 ${spec.changes.amountDelta >= 0 ? "+" : ""}${spec.changes.amountDelta}`);
  }
  if (typeof spec.changes.startMonthShift === "number") {
    lines.push(`開始月份 ${spec.changes.startMonthShift >= 0 ? "延後" : "提早"} ${Math.abs(spec.changes.startMonthShift)} 個月`);
  } else if (spec.changes.startMonth) {
    lines.push(`開始月份 ${spec.changes.startMonth}`);
  }
  if (typeof spec.changes.endMonthShift === "number") {
    lines.push(`結束月份 ${spec.changes.endMonthShift >= 0 ? "延後" : "提前"} ${Math.abs(spec.changes.endMonthShift)} 個月`);
  } else if (spec.changes.setEndMonth !== undefined) {
    lines.push(`結束月份 ${spec.changes.setEndMonth ?? "無"}`);
  } else if (spec.changes.endMonth !== undefined) {
    lines.push(`結束月份 ${spec.changes.endMonth ?? "無"}`);
  }
  return lines;
};
