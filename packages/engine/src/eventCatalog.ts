export type EventGroup =
  | "income"
  | "expense"
  | "housing"
  | "investment"
  | "insurance"
  | "debt";

export type EventDefaultSign = "inflow" | "outflow" | "mixed";

export type EventFieldKey =
  | "name"
  | "startMonth"
  | "endMonth"
  | "monthlyAmount"
  | "oneTimeAmount"
  | "annualGrowthPct"
  | "currency"
  | "enabled";

export type EventFieldInput = "text" | "month" | "number" | "percent" | "currency" | "toggle";

export type EventField = {
  key: EventFieldKey;
  input: EventFieldInput;
};

export type EventMeta = {
  label: string;
  group: EventGroup;
  defaultSign: EventDefaultSign;
  fields: readonly EventField[];
};

const baseFields: EventField[] = [
  { key: "name", input: "text" },
  { key: "startMonth", input: "month" },
  { key: "endMonth", input: "month" },
  { key: "monthlyAmount", input: "number" },
  { key: "oneTimeAmount", input: "number" },
  { key: "annualGrowthPct", input: "percent" },
  { key: "currency", input: "currency" },
  { key: "enabled", input: "toggle" },
];

const recurringFields: EventField[] = [
  { key: "name", input: "text" },
  { key: "startMonth", input: "month" },
  { key: "endMonth", input: "month" },
  { key: "monthlyAmount", input: "number" },
  { key: "annualGrowthPct", input: "percent" },
  { key: "currency", input: "currency" },
  { key: "enabled", input: "toggle" },
];

export const eventCatalog = {
  rent: {
    label: "Rent",
    group: "housing",
    defaultSign: "outflow",
    fields: recurringFields,
  },
  salary: {
    label: "Salary",
    group: "income",
    defaultSign: "inflow",
    fields: recurringFields,
  },
  buy_home: {
    label: "Buy home",
    group: "housing",
    defaultSign: "mixed",
    fields: [
      { key: "name", input: "text" },
      { key: "startMonth", input: "month" },
      { key: "endMonth", input: "month" },
      { key: "currency", input: "currency" },
      { key: "enabled", input: "toggle" },
    ],
  },
  baby: {
    label: "Baby",
    group: "expense",
    defaultSign: "outflow",
    fields: baseFields,
  },
  car: {
    label: "Car",
    group: "expense",
    defaultSign: "outflow",
    fields: baseFields,
  },
  travel: {
    label: "Travel",
    group: "expense",
    defaultSign: "outflow",
    fields: baseFields,
  },
  insurance: {
    label: "Insurance",
    group: "insurance",
    defaultSign: "outflow",
    fields: baseFields,
  },
  insurance_product: {
    label: "Insurance product",
    group: "insurance",
    defaultSign: "outflow",
    fields: [
      { key: "name", input: "text" },
      { key: "startMonth", input: "month" },
      { key: "monthlyAmount", input: "number" },
      { key: "currency", input: "currency" },
      { key: "enabled", input: "toggle" },
    ],
  },
  insurance_premium: {
    label: "Insurance premium",
    group: "insurance",
    defaultSign: "outflow",
    fields: [
      { key: "name", input: "text" },
      { key: "startMonth", input: "month" },
      { key: "endMonth", input: "month" },
      { key: "monthlyAmount", input: "number" },
      { key: "currency", input: "currency" },
      { key: "enabled", input: "toggle" },
    ],
  },
  insurance_payout: {
    label: "Insurance payout",
    group: "insurance",
    defaultSign: "inflow",
    fields: baseFields,
  },
  helper: {
    label: "Helper",
    group: "expense",
    defaultSign: "outflow",
    fields: baseFields,
  },
  investment_contribution: {
    label: "Investment contribution",
    group: "investment",
    defaultSign: "outflow",
    fields: recurringFields,
  },
  investment_withdrawal: {
    label: "Investment withdrawal",
    group: "investment",
    defaultSign: "inflow",
    fields: baseFields,
  },
  tax_benefit: {
    label: "Tax benefit",
    group: "insurance",
    defaultSign: "inflow",
    fields: baseFields,
  },
  custom: {
    label: "Custom",
    group: "expense",
    defaultSign: "mixed",
    fields: baseFields,
  },
} as const;

export type EventType = keyof typeof eventCatalog;

export const eventTypes = Object.keys(eventCatalog) as EventType[];

export const eventGroups: EventGroup[] = [
  "income",
  "expense",
  "housing",
  "investment",
  "insurance",
  "debt",
];

export const getEventMeta = (type: EventType): EventMeta => eventCatalog[type];

export const getEventGroup = (type: EventType): EventGroup => eventCatalog[type].group;

export const listEventTypesByGroup = (group: EventGroup): EventType[] =>
  (Object.keys(eventCatalog) as EventType[]).filter(
    (type) => eventCatalog[type].group === group
  );
