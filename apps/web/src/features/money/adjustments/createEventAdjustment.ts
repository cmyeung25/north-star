import type { ScenarioEvent } from "../../../domain/scenarioV2/events";
import type { LedgerRow } from "../../../engine/scenarioV2Compiler";
import {
  buildSalaryAdjustmentTags,
  deriveRecurringGroupId,
  resolveRecurringGroupId,
} from "../salaryAdjustmentTags";
import { addMonths } from "../../../domain/members/age";
import { isValidMonthKey } from "../../../utils/monthKey";

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
    meta?: {
      kind?: "adjustment";
      parentEventId?: string;
      adjustsEventId?: string;
    };
    parentStartMonth?: string;
    parentEndMonth?: string;
  };
  spec: EventAdjustmentSpec;
};

const resolveParentWindow = (event: ScenarioEvent): { startMonth?: string; endMonth?: string } => {
  if (event.type === "cashflow") {
    if (event.cadence === "oneOff") {
      return { startMonth: event.occurrenceMonth, endMonth: event.occurrenceMonth };
    }
    return { startMonth: event.startMonth, endMonth: event.endMonth };
  }
  if (event.type === "housing" || event.type === "insurance") {
    return { startMonth: event.startMonth, endMonth: event.endMonth };
  }
  if (event.type === "loan") {
    const startMonth = event.startMonth;
    const termMonths = Math.max(0, Math.round((event.termYears ?? 0) * 12));
    const endMonth =
      startMonth && termMonths > 0 ? addMonths(startMonth, termMonths - 1) : undefined;
    return { startMonth, endMonth };
  }
  return { startMonth: event.month, endMonth: event.month };
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
  if (!spec.effectiveMonth || !isValidMonthKey(spec.effectiveMonth)) {
    return null;
  }
  const parentWindow = resolveParentWindow(baseEvent);
  const baseMeta = {
    parentEventId: baseEvent.id,
    effectiveMonth: spec.effectiveMonth,
    meta: {
      kind: "adjustment" as const,
      parentEventId: baseEvent.id,
      adjustsEventId: baseEvent.id,
    },
    parentStartMonth: parentWindow.startMonth,
    parentEndMonth: parentWindow.endMonth,
  };

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
        tags: buildSalaryAdjustmentTags(baseEvent.id),
        groupId,
        groupRole: "adjustment",
        ...baseMeta,
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
        ...baseMeta,
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
        ...baseMeta,
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
        ...baseMeta,
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
        ...baseMeta,
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
        ...baseMeta,
      },
      spec,
    };
  }

  return null;
};
