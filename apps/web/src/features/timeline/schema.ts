import { z } from "zod";
import { eventTypes, type EventType } from "@north-star/engine";
import { defaultCurrency } from "../../../lib/i18n";

const eventTypeValues = eventTypes as [EventType, ...EventType[]];

export const EventTypeSchema = z.enum(eventTypeValues);

const monthPattern = /^\d{4}-\d{2}$/;

export const TimelineEventSchema = z.object({
  id: z.string(),
  type: EventTypeSchema,
  name: z.string(),
  startMonth: z.string().regex(monthPattern),
  endMonth: z.string().regex(monthPattern).nullable(),
  enabled: z.boolean(),
  monthlyAmount: z.number().default(0),
  oneTimeAmount: z.number().default(0),
  annualGrowthPct: z.number().default(0),
  currency: z.string().default(defaultCurrency),
});

export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
export type { EventType };

export const normalizeMonth = (input: string): string | null => {
  const value = input.trim();
  const match = /^(\d{4})-(\d{1,2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = match[1];
  const month = Number(match[2]);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}`;
};

const clampAnnualGrowthPct = (value: number) =>
  Math.min(Math.max(value, 0), 100);

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

type NormalizeEventOptions = {
  baseCurrency?: string;
  fallbackMonth?: string | null;
};

export const normalizeEvent = (
  event: Partial<TimelineEvent> & Pick<TimelineEvent, "id" | "type">,
  options: NormalizeEventOptions = {}
): TimelineEvent => {
  const normalizedStartMonth =
    normalizeMonth(event.startMonth ?? "") ??
    normalizeMonth(options.fallbackMonth ?? "") ??
    getCurrentMonth();
  const normalizedEndMonth = normalizeMonth(event.endMonth ?? "") ?? null;

  return TimelineEventSchema.parse({
    id: event.id,
    type: event.type,
    name: event.name ?? "",
    startMonth: normalizedStartMonth,
    endMonth: normalizedEndMonth,
    enabled: event.enabled ?? true,
    monthlyAmount: Number(event.monthlyAmount ?? 0),
    oneTimeAmount: Number(event.oneTimeAmount ?? 0),
    annualGrowthPct: clampAnnualGrowthPct(Number(event.annualGrowthPct ?? 0)),
    currency: event.currency ?? options.baseCurrency ?? defaultCurrency,
  });
};
