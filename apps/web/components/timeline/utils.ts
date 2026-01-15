import { nanoid } from "nanoid";
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
import type { EventType, TimelineEvent } from "./types";

export const eventTypeLabels: Record<EventType, string> = {
  rent: t("eventTypeRent"),
  buy_home: t("eventTypeBuyHome"),
  baby: t("eventTypeBaby"),
  car: t("eventTypeCar"),
  travel: t("eventTypeTravel"),
  insurance: t("eventTypeInsurance"),
  helper: t("eventTypeHelper"),
  custom: t("eventTypeCustom"),
};

export const iconMap: Record<EventType, string> = {
  rent: "🏠",
  buy_home: "🏡",
  baby: "🍼",
  car: "🚗",
  travel: "✈️",
  insurance: "🛡️",
  helper: "🤝",
  custom: "✨",
};

export const templateOptions: Array<{ label: string; type: EventType }> = [
  { label: t("eventTypeRent"), type: "rent" },
  { label: t("eventTypeBuyHome"), type: "buy_home" },
  { label: t("eventTypeBaby"), type: "baby" },
  { label: t("eventTypeCar"), type: "car" },
  { label: t("eventTypeTravel"), type: "travel" },
  { label: t("eventTypeInsurance"), type: "insurance" },
  { label: t("eventTypeHelper"), type: "helper" },
  { label: t("eventTypeCustom"), type: "custom" },
];

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
  const label = eventTypeLabels[type];
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
  };
};

export const formatHomeSummary = (home: HomePosition, currency: string) => {
  const formattedPrice = formatCurrency(home.purchasePrice, currency);
  const termYears = Math.round(home.mortgageTermYears);
  const rate = home.mortgageRatePct.toFixed(1);
  return `Home: ${formattedPrice} · Mortgage ${termYears}y @ ${rate}%`;
};
