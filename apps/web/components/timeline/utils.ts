// Shape note: HomePosition template originally set purchase/mortgage/appreciation (+feesOneTime).
// Added defaults for holdingCostMonthly and holdingCostAnnualGrowthPct.
// Back-compat: new fields default to 0 for older scenarios.
import { nanoid } from "nanoid";
import {
  eventGroups,
  getEventGroup,
  getEventMeta,
  listEventTypesByGroup,
  type EventGroup,
  type EventType,
} from "@north-star/engine";
import {
  defaultCurrency,
  formatCurrency as formatCurrencyWithLocale,
  t,
} from "../../lib/i18n";
import { normalizeEvent, normalizeMonth } from "../../src/features/timeline/schema";
import {
  createHomePositionId,
  type HomePosition,
  type HomePositionDraft,
} from "../../src/store/scenarioStore";
import type { TimelineEvent } from "./types";

export const getEventLabel = (type: EventType) => getEventMeta(type).label;

export const iconMap: Record<EventType, string> = {
  rent: "🏠",
  salary: "💼",
  buy_home: "🏡",
  baby: "🍼",
  car: "🚗",
  travel: "✈️",
  insurance: "🛡️",
  helper: "🤝",
  custom: "✨",
};

export const groupLabels: Record<EventGroup, string> = {
  income: "Income",
  expense: "Expense",
  housing: "Housing",
  asset: "Asset",
  debt: "Debt",
};

export const impactHints: Record<EventGroup, string> = {
  income: "adds cash inflow",
  expense: "adds cash outflow",
  housing: "may affect cash + assets + liabilities",
  asset: "may affect assets and/or cash",
  debt: "may affect liabilities and cash",
};

export const eventFilterOptions = [
  { label: "All", value: "all" },
  ...eventGroups.map((group) => ({
    label: groupLabels[group],
    value: group,
  })),
];

export const listEventTypesForGroup = (group: EventGroup) =>
  listEventTypesByGroup(group);

export const getEventGroupLabel = (type: EventType) =>
  groupLabels[getEventGroup(type)];

export const getEventImpactHint = (type: EventType) =>
  impactHints[getEventGroup(type)];

export const formatCurrency = (amount: number, currency: string) =>
  formatCurrencyWithLocale(amount, currency);

export const formatDateRange = (start: string, end: string | null) => {
  if (!end) {
    return `${start} → ${t("timelineOngoing")}`;
  }

  return `${start} → ${end}`;
};

export const createEventId = () => `evt_${nanoid(8)}`;

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

const getDefaultStartMonth = (baseMonth?: string | null) =>
  normalizeMonth(baseMonth ?? "") ?? getCurrentMonth();

const templateDefaults: Record<
  EventType,
  { monthlyAmount: number; oneTimeAmount: number; annualGrowthPct: number }
> = {
  rent: { monthlyAmount: 1800, oneTimeAmount: 0, annualGrowthPct: 3 },
  salary: { monthlyAmount: 6000, oneTimeAmount: 0, annualGrowthPct: 3 },
  buy_home: { monthlyAmount: 0, oneTimeAmount: 800000, annualGrowthPct: 0 },
  baby: { monthlyAmount: 900, oneTimeAmount: 5000, annualGrowthPct: 2 },
  car: { monthlyAmount: 600, oneTimeAmount: 20000, annualGrowthPct: 0 },
  travel: { monthlyAmount: 0, oneTimeAmount: 4000, annualGrowthPct: 0 },
  insurance: { monthlyAmount: 250, oneTimeAmount: 0, annualGrowthPct: 0 },
  helper: { monthlyAmount: 600, oneTimeAmount: 0, annualGrowthPct: 0 },
  custom: { monthlyAmount: 0, oneTimeAmount: 0, annualGrowthPct: 0 },
};

type CreateEventOptions = {
  baseCurrency?: string;
  baseMonth?: string | null;
};

export const createEventFromTemplate = (
  type: EventType,
  options: CreateEventOptions = {}
): TimelineEvent => {
  const label = getEventLabel(type);
  const defaults = templateDefaults[type];
  const startMonth = getDefaultStartMonth(options.baseMonth);

  return normalizeEvent(
    {
      id: createEventId(),
      type,
      name: t("timelineEventPlan", { label }),
      startMonth,
      endMonth: null,
      enabled: true,
      monthlyAmount: defaults.monthlyAmount,
      oneTimeAmount: defaults.oneTimeAmount,
      annualGrowthPct: defaults.annualGrowthPct,
      currency: options.baseCurrency ?? defaultCurrency,
    },
    {
      baseCurrency: options.baseCurrency ?? defaultCurrency,
      fallbackMonth: startMonth,
    }
  );
};

export const createHomePositionFromTemplate = (
  options?: { baseMonth?: string | null; purchaseMonth?: string | null }
): HomePositionDraft => {
  const purchaseMonth = getDefaultStartMonth(
    normalizeMonth(options?.purchaseMonth ?? "") ?? options?.baseMonth ?? null
  );
  const purchasePrice = 9_000_000;
  const downPayment = 1_800_000;

  return {
    id: createHomePositionId(),
    purchasePrice,
    downPayment,
    purchaseMonth,
    annualAppreciationPct: 2,
    mortgageRatePct: 3.5,
    mortgageTermYears: 30,
    feesOneTime: 300_000,
    holdingCostMonthly: 0,
    holdingCostAnnualGrowthPct: 0,
  };
};

export const formatHomeSummary = (home: HomePosition, currency: string) => {
  const formattedPrice = formatCurrency(home.purchasePrice, currency);
  const termYears = Math.round(home.mortgageTermYears);
  const rate = home.mortgageRatePct.toFixed(1);
  return `Home: ${formattedPrice} · Mortgage ${termYears}y @ ${rate}%`;
};
