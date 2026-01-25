import type { EventType } from "@north-star/engine";

type TranslationFn = ((key: string, values?: Record<string, string | number>) => string) & {
  has?: (key: string) => boolean;
};

export const ONBOARDING_EVENT_TYPES: EventType[] = [
  "custom",
  "salary",
  "rent",
  "baby",
  "car",
  "travel",
  "insurance",
  "helper",
  "tax_benefit",
];

const EVENT_TYPE_LABEL_KEYS: Partial<Record<EventType, string>> = {
  rent: "eventType.rent",
  salary: "eventType.salary",
  baby: "eventType.baby",
  car: "eventType.car",
  travel: "eventType.travel",
  insurance: "eventType.insurance",
  helper: "eventType.helper",
  tax_benefit: "eventType.tax_benefit",
  custom: "eventType.custom",
};

export const getEventTypeLabel = (type: EventType, t: TranslationFn) => {
  const labelKey = EVENT_TYPE_LABEL_KEYS[type];
  if (labelKey && (!t.has || t.has(labelKey))) {
    return t(labelKey);
  }
  return t("eventTypeFallback", { type });
};
