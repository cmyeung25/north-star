import type { EventType } from "../features/timeline/schema";

export type EventGroup = "income" | "expense" | "housing" | "asset" | "debt";

export type EventSign = 1 | -1;

export type EventMeta = {
  group: EventGroup;
  sign: EventSign;
};

const fallbackMeta: EventMeta = { group: "income", sign: 1 };

const eventCatalog: Record<EventType, EventMeta> = {
  rent: { group: "housing", sign: -1 },
  salary: { group: "income", sign: 1 },
  buy_home: { group: "housing", sign: -1 },
  baby: { group: "expense", sign: -1 },
  car: { group: "expense", sign: -1 },
  travel: { group: "expense", sign: -1 },
  insurance: { group: "expense", sign: -1 },
  helper: { group: "expense", sign: -1 },
  custom: { group: "expense", sign: -1 },
};

export const getEventMeta = (type: EventType | string): EventMeta =>
  eventCatalog[type as EventType] ?? fallbackMeta;

export const getEventSign = (type: EventType | string): EventSign =>
  getEventMeta(type).sign;
