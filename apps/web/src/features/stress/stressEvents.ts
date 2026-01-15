import type { Scenario, TimelineEvent } from "../../store/scenarioStore";
import { normalizeMonth } from "../timeline/schema";

export type AppliedStressState = {
  jobLossMonths?: 3 | 6 | 12 | null;
  rateHikePct?: 0.5 | 1 | 2 | null;
  medicalAmount?: number | null;
  applyMonth?: string | null;
};

const housingKeywords = ["rent", "mortgage", "housing", "home"];
const housingCostThreshold = -500;

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

const addMonths = (baseMonth: string, offset: number) => {
  const [year, month] = baseMonth.split("-").map(Number);
  const totalMonths = year * 12 + (month - 1) + offset;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = String((totalMonths % 12) + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
};

const getEarliestEnabledMonth = (events: TimelineEvent[]) =>
  events.reduce<string | null>((earliest, event) => {
    if (!event.enabled) {
      return earliest;
    }
    if (!earliest || event.startMonth < earliest) {
      return event.startMonth;
    }
    return earliest;
  }, null);

const resolveApplyMonth = (params: AppliedStressState, scenario: Scenario) => {
  const normalized = normalizeMonth(params.applyMonth ?? "");
  if (normalized) {
    return normalized;
  }

  const scenarioBaseMonth = normalizeMonth(scenario.assumptions.baseMonth ?? "");
  if (scenarioBaseMonth) {
    return scenarioBaseMonth;
  }

  const earliestEventMonth = getEarliestEnabledMonth(scenario.events ?? []);
  return earliestEventMonth ?? getCurrentMonth();
};

const isEventActiveInMonth = (event: TimelineEvent, month: string) => {
  if (!event.enabled) {
    return false;
  }

  if (event.startMonth > month) {
    return false;
  }

  if (event.endMonth && event.endMonth < month) {
    return false;
  }

  return true;
};

const isHousingEvent = (event: TimelineEvent) => {
  if (event.type === "buy_home" || event.type === "rent") {
    return true;
  }

  const name = event.name.toLowerCase();
  return housingKeywords.some((keyword) => name.includes(keyword));
};

const formatIdValue = (value: number | string) =>
  String(value).replace(/\./g, "_");

export const calculateBaselineIncomeMonthly = (
  events: TimelineEvent[],
  applyMonth: string
) =>
  events.reduce((total, event) => {
    if (!isEventActiveInMonth(event, applyMonth)) {
      return total;
    }
    const amount = event.monthlyAmount ?? 0;
    if (amount <= 0) {
      return total;
    }
    return total + amount;
  }, 0);

const calculateHousingCostMonthly = (
  events: TimelineEvent[],
  applyMonth: string
) =>
  events.reduce((total, event) => {
    if (!isEventActiveInMonth(event, applyMonth)) {
      return total;
    }
    const amount = event.monthlyAmount ?? 0;
    if (isHousingEvent(event)) {
      return total + Math.abs(amount);
    }
    if (amount < housingCostThreshold) {
      return total + Math.abs(amount);
    }
    return total;
  }, 0);

type Translator = (key: string, values?: Record<string, string | number>) => string;

export const buildStressEvents = (
  params: AppliedStressState,
  scenario: Scenario,
  t: Translator
): TimelineEvent[] => {
  const applyMonth = resolveApplyMonth(params, scenario);
  const events: TimelineEvent[] = [];
  const baseCurrency = scenario.baseCurrency;
  const sourceEvents = scenario.events ?? [];

  if (params.jobLossMonths) {
    const baselineIncomeMonthly = calculateBaselineIncomeMonthly(
      sourceEvents,
      applyMonth
    );
    const endMonth = addMonths(applyMonth, params.jobLossMonths - 1);

    events.push({
      id: `stress_jobloss_${params.jobLossMonths}m_${applyMonth}`,
      type: "custom",
      name: t("stressEventJobLoss", { months: params.jobLossMonths }),
      startMonth: applyMonth,
      endMonth,
      monthlyAmount: -baselineIncomeMonthly,
      oneTimeAmount: 0,
      annualGrowthPct: 0,
      enabled: true,
      currency: baseCurrency,
    });
  }

  if (params.rateHikePct) {
    const housingCostMonthly = calculateHousingCostMonthly(
      sourceEvents,
      applyMonth
    );
    const hasBuyHome = sourceEvents.some(
      (event) => event.enabled && event.type === "buy_home"
    );
    const deltaCost = hasBuyHome
      ? Math.abs(housingCostMonthly) * params.rateHikePct * 0.2
      : 0;

    events.push({
      id: `stress_ratehike_${formatIdValue(params.rateHikePct)}pct_${applyMonth}`,
      type: "custom",
      name: t("stressEventRateHike", { rate: params.rateHikePct }),
      startMonth: applyMonth,
      endMonth: null,
      monthlyAmount: -deltaCost,
      oneTimeAmount: 0,
      annualGrowthPct: 0,
      enabled: true,
      currency: baseCurrency,
    });
  }

  if (typeof params.medicalAmount === "number" && params.medicalAmount > 0) {
    events.push({
      id: `stress_medical_${formatIdValue(params.medicalAmount)}_${applyMonth}`,
      type: "custom",
      name: t("stressEventMedical"),
      startMonth: applyMonth,
      endMonth: applyMonth,
      monthlyAmount: 0,
      oneTimeAmount: -params.medicalAmount,
      annualGrowthPct: 0,
      enabled: true,
      currency: baseCurrency,
    });
  }

  return events;
};
