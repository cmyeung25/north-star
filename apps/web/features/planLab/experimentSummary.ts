import type { ScenarioEvent } from "../../src/domain/scenarioV2/events";
import type { EventOverrideExperimentSpec } from "../../src/domain/planLab/eventOverrideExperiment";

const formatSignedPercent = (value: number) => `${value >= 0 ? "+" : ""}${value}%`;

const formatSignedCurrency = (value: number, currency: string, locale: string) => {
  const amount = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
  return `${value >= 0 ? "+" : "-"}${amount}`;
};

const formatGrowth = (mode?: "none" | "assumption" | "custom", rate?: number) => {
  if (!mode) {
    return null;
  }
  if (mode === "assumption") {
    return "成長：跟隨假設";
  }
  if (mode === "none") {
    return "成長：不成長";
  }
  return `成長：自訂 ${rate ?? 0}%`;
};

export const formatExperimentChanges = (
  event: ScenarioEvent,
  spec: EventOverrideExperimentSpec,
  currency: string,
  locale: string
): string[] => {
  if (event.type !== "cashflow") {
    return [];
  }
  const lines: string[] = [];
  if (typeof spec.changes.amountMultiplier === "number") {
    const pct = Math.round((spec.changes.amountMultiplier - 1) * 100);
    lines.push(`金額 ${formatSignedPercent(pct)}`);
  } else if (typeof spec.changes.amountDelta === "number") {
    lines.push(`金額 ${formatSignedCurrency(spec.changes.amountDelta, currency, locale)}`);
  }
  if (typeof spec.changes.startMonthShift === "number") {
    lines.push(`開始月份${spec.changes.startMonthShift >= 0 ? "延後" : "提早"} ${Math.abs(spec.changes.startMonthShift)} 個月`);
  }
  if (typeof spec.changes.endMonthShift === "number") {
    lines.push(`結束月份${spec.changes.endMonthShift >= 0 ? "延後" : "提前"} ${Math.abs(spec.changes.endMonthShift)} 個月`);
  }
  const growthText = formatGrowth(spec.changes.growthMode, spec.changes.growthRate);
  if (growthText) {
    lines.push(growthText);
  }
  return lines;
};

export const formatExperimentSummary = (changes: string[]): string =>
  changes.length > 0 ? changes.slice(0, 2).join("；") : "已建立實驗";
