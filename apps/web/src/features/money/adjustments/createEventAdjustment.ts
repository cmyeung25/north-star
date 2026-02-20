import type { ScenarioEvent } from "../../../domain/scenarioV2/events";
import type { LedgerRow } from "../../../engine/scenarioV2Compiler";

export type EventAdjustmentSpec = {
  effectiveMonth?: string;
  endMonth?: string;
  mode: "delta" | "override";
  amount: number;
  row?: LedgerRow;
};

export type EventAdjustmentPayload =
  | {
      type: "salary-adjustment";
      baseEvent: {
        id: string;
        type: ScenarioEvent["type"];
        cadence?: string;
        amount: number;
        startMonth?: string;
        endMonth?: string;
      };
      spec: EventAdjustmentSpec;
    }
  | {
      type: "event-adjustment";
      row: LedgerRow;
      spec: EventAdjustmentSpec;
    };

const isCashflowEvent = (
  event: ScenarioEvent
): event is Extract<ScenarioEvent, { type: "cashflow" }> =>
  event.type === "cashflow";

const isSalaryBaseEvent = (
  event: ScenarioEvent
): event is Extract<ScenarioEvent, { type: "cashflow" }> =>
  isCashflowEvent(event) && event.kind === "income" && event.cadence === "monthly";

export const createEventAdjustmentPayload = (
  baseEvent: ScenarioEvent,
  spec: EventAdjustmentSpec
): EventAdjustmentPayload | null => {
  if (!isCashflowEvent(baseEvent)) {
    return null;
  }

  if (isSalaryBaseEvent(baseEvent)) {
    return {
      type: "salary-adjustment",
      baseEvent: {
        id: baseEvent.id,
        type: baseEvent.type,
        cadence: baseEvent.cadence,
        amount: baseEvent.amount,
        startMonth: baseEvent.startMonth,
        endMonth: baseEvent.endMonth,
      },
      spec,
    };
  }

  if (!spec.row) {
    return null;
  }

  return {
    type: "event-adjustment",
    row: spec.row,
    spec,
  };
};

