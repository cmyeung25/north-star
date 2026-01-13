export type EventType =
  | "rent"
  | "buy_home"
  | "baby"
  | "car"
  | "travel"
  | "insurance"
  | "helper"
  | "custom";

export interface TimelineEvent {
  id: string;
  type: EventType;
  name: string;
  startMonth: string;
  endMonth: string | null;
  enabled: boolean;
  monthlyAmount: number;
  oneTimeAmount: number;
  annualGrowthPct: number;
  currency: string;
}
