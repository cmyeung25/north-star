import type { EventType } from "@north-star/engine";

type TranslationFn = ((key: string, values?: Record<string, string | number>) => string) & {
  has?: (key: string) => boolean;
};

export const ONBOARDING_EVENT_TYPES: EventType[] = [
  "custom",
  // "salary",
  "rent",
  // "baby",
  // "car",
  "travel",
  // "insurance",
  // "helper",
  // "tax_benefit",
];

const EVENT_TYPE_LABEL_KEYS: Partial<Record<EventType, string>> = {
  rent: "eventTypes.rent",
  salary: "eventTypes.salary",
  baby: "eventTypes.baby",
  car: "eventTypes.car",
  travel: "eventTypes.travel",
  insurance: "eventTypes.insurance",
  helper: "eventTypes.helper",
  tax_benefit: "eventTypes.tax_benefit",
  custom: "eventTypes.custom",
};

export const getEventTypeLabel = (type: EventType, t: TranslationFn) => {
  const labelKey = EVENT_TYPE_LABEL_KEYS[type];
  if (labelKey && (!t.has || t.has(labelKey))) {
    return t(labelKey);
  }
  return t("eventTypeFallback", { type });
};
