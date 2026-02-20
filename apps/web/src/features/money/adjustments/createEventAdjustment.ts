import type { ScenarioEvent } from "../../../domain/scenarioV2/events";
import type { LedgerRow } from "../../../engine/scenarioV2Compiler";
import {
  buildSalaryAdjustmentTags,
  deriveRecurringGroupId,
  resolveRecurringGroupId,
} from "../salaryAdjustmentTags";

export type EventAdjustmentSpec = {
  effectiveMonth?: string;
  endMonth?: string;
  mode: "delta" | "override";
  amount: number;
  row?: LedgerRow;
};

type EventAdjustmentBasePayload<TType extends ScenarioEvent["type"]> = {
  baseEvent: {
    id: string;
    type: TType;
    parentEventId?: string;
    tags?: string[];
    groupId?: string;
    groupRole?: "base" | "adjustment";
    effectiveMonth?: string;
  };
  spec: EventAdjustmentSpec;
};

export type EventAdjustmentPayload =
  | ({ type: "cashflow-adjustment" } & EventAdjustmentBasePayload<"cashflow">)
  | ({ type: "housing-adjustment" } & EventAdjustmentBasePayload<"housing">)
  | ({ type: "loan-adjustment" } & EventAdjustmentBasePayload<"loan">)
  | ({ type: "insurance-adjustment" } & EventAdjustmentBasePayload<"insurance">)
  | ({ type: "adjustment-adjustment" } & EventAdjustmentBasePayload<"adjustment">);

export const createEventAdjustmentPayload = (
  baseEvent: ScenarioEvent,
  spec: EventAdjustmentSpec
): EventAdjustmentPayload | null => {
  if (
    baseEvent.type === "cashflow" &&
    baseEvent.kind === "income" &&
    baseEvent.cadence === "monthly"
  ) {
    const groupId = resolveRecurringGroupId(baseEvent) ?? deriveRecurringGroupId(baseEvent);
    return {
      type: "cashflow-adjustment",
      baseEvent: {
        id: baseEvent.id,
        type: baseEvent.type,
        parentEventId: baseEvent.id,
        tags: buildSalaryAdjustmentTags(baseEvent.id),
        groupId,
        groupRole: "adjustment",
        effectiveMonth: spec.effectiveMonth,
      },
      spec,
    };
  }

  if (baseEvent.type === "cashflow") {
    return {
      type: "cashflow-adjustment",
      baseEvent: {
        id: baseEvent.id,
        type: baseEvent.type,
      },
      spec,
    };
  }

  if (baseEvent.type === "housing") {
    return {
      type: "housing-adjustment",
      baseEvent: {
        id: baseEvent.id,
        type: baseEvent.type,
      },
      spec,
    };
  }

  if (baseEvent.type === "loan") {
    return {
      type: "loan-adjustment",
      baseEvent: {
        id: baseEvent.id,
        type: baseEvent.type,
      },
      spec,
    };
  }

  if (baseEvent.type === "insurance") {
    return {
      type: "insurance-adjustment",
      baseEvent: {
        id: baseEvent.id,
        type: baseEvent.type,
      },
      spec,
    };
  }

  if (baseEvent.type === "adjustment") {
    return {
      type: "adjustment-adjustment",
      baseEvent: {
        id: baseEvent.id,
        type: baseEvent.type,
      },
      spec,
    };
  }

  return null;
};
