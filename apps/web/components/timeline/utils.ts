import type { EventType, TimelineEvent } from "./types";

export const eventTypeLabels: Record<EventType, string> = {
  rent: "Rent",
  buy_home: "Buy Home",
  baby: "Baby",
  car: "Car",
  travel: "Travel",
  insurance: "Insurance",
  helper: "Helper",
  custom: "Custom",
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
  { label: "Rent", type: "rent" },
  { label: "Buy Home", type: "buy_home" },
  { label: "Baby", type: "baby" },
  { label: "Car", type: "car" },
  { label: "Travel", type: "travel" },
  { label: "Insurance", type: "insurance" },
  { label: "Helper", type: "helper" },
  { label: "Custom", type: "custom" },
];

const formatters = new Map<string, Intl.NumberFormat>();

export const formatCurrency = (amount: number, currency: string) => {
  if (!formatters.has(currency)) {
    formatters.set(
      currency,
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      })
    );
  }

  return formatters.get(currency)?.format(amount) ?? `${amount} ${currency}`;
};

export const formatDateRange = (start: string, end: string | null) => {
  if (!end) {
    return `${start} → ongoing`;
  }

  return `${start} → ${end}`;
};

const createEventId = () =>
  `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const createEventFromTemplate = (type: EventType): TimelineEvent => {
  const label = eventTypeLabels[type];

  return {
    id: createEventId(),
    type,
    name: `${label} plan`,
    startMonth: "2025-01",
    endMonth: null,
    enabled: true,
    monthlyAmount: 0,
    oneTimeAmount: 0,
    annualGrowthPct: 0,
    currency: "USD",
  };
};

export const mockedEvents: TimelineEvent[] = [
  {
    id: createEventId(),
    type: "rent",
    name: "Downtown rent",
    startMonth: "2024-09",
    endMonth: null,
    enabled: true,
    monthlyAmount: 1800,
    oneTimeAmount: 0,
    annualGrowthPct: 3,
    currency: "USD",
  },
  {
    id: createEventId(),
    type: "travel",
    name: "Japan trip",
    startMonth: "2026-03",
    endMonth: "2026-03",
    enabled: true,
    monthlyAmount: 0,
    oneTimeAmount: 4200,
    annualGrowthPct: 0,
    currency: "USD",
  },
  {
    id: createEventId(),
    type: "car",
    name: "Family SUV",
    startMonth: "2025-06",
    endMonth: "2030-06",
    enabled: false,
    monthlyAmount: 540,
    oneTimeAmount: 12000,
    annualGrowthPct: 2,
    currency: "USD",
  },
];
