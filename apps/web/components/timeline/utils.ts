import { nanoid } from "nanoid";
import { defaultCurrency, formatCurrency as formatCurrencyWithLocale, t } from "../../lib/i18n";
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

const createEventId = () => `evt_${nanoid(8)}`;

export const createEventFromTemplate = (type: EventType): TimelineEvent => {
  const label = eventTypeLabels[type];

  return {
    id: createEventId(),
    type,
    name: t("timelineEventPlan", { label }),
    startMonth: "2025-01",
    endMonth: null,
    enabled: true,
    monthlyAmount: 0,
    oneTimeAmount: 0,
    annualGrowthPct: 0,
    currency: defaultCurrency,
  };
};
