import { compareMonthKey, isValidMonthKey } from "../../utils/monthKey";
import type { MoneyItemCadence, MoneyItemUpsert } from "../../../features/moneyFlow/types";
import {
  type MilestoneEvent,
  type MilestoneEventCompileResult,
  type MilestoneEventWarning,
  type MilestoneScenarioSnapshot,
  resolveMoneyItemKindFromEvent,
} from "./types";

const warn = (
  warnings: MilestoneEventWarning[],
  message: string,
  options?: { field?: string; level?: MilestoneEventWarning["level"] }
) => {
  warnings.push({
    id: `${options?.field ?? "warning"}-${warnings.length + 1}`,
    level: options?.level ?? "warning",
    message,
    field: options?.field,
  });
};

const resolveMoneyItemRange = (item: {
  cadence: MoneyItemCadence;
  startMonth?: string | null;
  endMonth?: string | null;
  month?: string | null;
}): { start?: string; end?: string } => {
  if (item.cadence === "oneOff") {
    const month = item.month ?? undefined;
    if (month && isValidMonthKey(month)) {
      return { start: month, end: month };
    }
    return {};
  }

  const startMonth = item.startMonth ?? undefined;
  const endMonth = item.endMonth ?? startMonth ?? undefined;
  if (startMonth && isValidMonthKey(startMonth)) {
    if (endMonth && isValidMonthKey(endMonth)) {
      return compareMonthKey(startMonth, endMonth) <= 0
        ? { start: startMonth, end: endMonth }
        : { start: startMonth, end: startMonth };
    }
    return { start: startMonth, end: startMonth };
  }
  return {};
};

const rangesOverlap = (
  a: { start?: string; end?: string },
  b: { start?: string; end?: string }
) => {
  if (!a.start || !a.end || !b.start || !b.end) {
    return false;
  }
  return compareMonthKey(a.start, b.end) <= 0 && compareMonthKey(b.start, a.end) <= 0;
};

const addFieldError = (
  fieldErrors: Record<string, string>,
  warnings: MilestoneEventWarning[],
  field: string,
  message: string
) => {
  fieldErrors[field] = message;
  warn(warnings, message, { field, level: "error" });
};

export const compileEventToOps = (
  event: MilestoneEvent,
  snapshot: MilestoneScenarioSnapshot
): MilestoneEventCompileResult => {
  const warnings: MilestoneEventWarning[] = [];
  const fieldErrors: Record<string, string> = {};
  const ops: MilestoneEventCompileResult["ops"] = [];

  if (!isValidMonthKey(event.effectiveMonth)) {
    addFieldError(fieldErrors, warnings, "effectiveMonth", "Effective month is required.");
  }

  if (event.mode === "marker") {
    return { ops, warnings, fieldErrors };
  }

  if (!event.payload) {
    addFieldError(fieldErrors, warnings, "payload", "Missing event payload.");
    return { ops, warnings, fieldErrors };
  }

  if (!event.eventType) {
    addFieldError(fieldErrors, warnings, "eventType", "Unsupported event type.");
    return { ops, warnings, fieldErrors };
  }

  if (event.eventType === "income" || event.eventType === "expense") {
    if (event.payload.kind !== "money") {
      addFieldError(fieldErrors, warnings, "payload", "Missing money payload.");
      return { ops, warnings, fieldErrors };
    }

    const kind = resolveMoneyItemKindFromEvent(event.eventType);
    const payload = event.payload.data;

    if (!kind) {
      addFieldError(fieldErrors, warnings, "eventType", "Unsupported money event type.");
      return { ops, warnings, fieldErrors };
    }

    if (!payload.category) {
      addFieldError(fieldErrors, warnings, "category", "Category is required.");
    }

    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      addFieldError(fieldErrors, warnings, "amount", "Amount must be greater than zero.");
    }

    const cadence = payload.cadence;
    if (!cadence) {
      addFieldError(fieldErrors, warnings, "cadence", "Cadence is required.");
    }

    const currency = payload.currency || snapshot.baseCurrency;

    const startMonth =
      cadence === "recurring" ? payload.startMonth ?? event.effectiveMonth : undefined;
    const endMonth = cadence === "recurring" ? payload.endMonth ?? undefined : undefined;
    const month = cadence === "oneOff" ? payload.month ?? event.effectiveMonth : undefined;

    if (cadence === "recurring" && startMonth && !isValidMonthKey(startMonth)) {
      addFieldError(fieldErrors, warnings, "startMonth", "Start month is invalid.");
    }
    if (cadence === "recurring" && endMonth && !isValidMonthKey(endMonth)) {
      addFieldError(fieldErrors, warnings, "endMonth", "End month is invalid.");
    }
    if (cadence === "oneOff" && month && !isValidMonthKey(month)) {
      addFieldError(fieldErrors, warnings, "month", "One-off month is invalid.");
    }

    if (Object.keys(fieldErrors).length === 0) {
      const item: MoneyItemUpsert = {
        kind,
        cadence,
        amount: payload.amount,
        currency,
        category: payload.category,
        memberId: payload.memberId,
        startMonth: cadence === "recurring" ? startMonth : undefined,
        endMonth: cadence === "recurring" ? endMonth : undefined,
        month: cadence === "oneOff" ? month : undefined,
        notes: payload.notes,
        source: "eventGenerated",
        sourceType:
          kind === "expense" && cadence === "recurring" ? "budgetRule" : "event",
        generatedByEventId: event.id,
      };

      ops.push({ action: "upsert", entity: "moneyItem", item });

      const nextRange = resolveMoneyItemRange(item);
      const matches = snapshot.moneyItems.filter(
        (existing) =>
          existing.source === "manual" &&
          existing.kind === item.kind &&
          existing.cadence === item.cadence &&
          existing.category === item.category
      );

      if (matches.some((existing) => rangesOverlap(nextRange, resolveMoneyItemRange(existing)))) {
        warn(
          warnings,
          `Potential double counting: a manual ${item.kind} entry already matches ${item.category}.`
        );
      }
    }

    return { ops, warnings, fieldErrors };
  }

  if (event.eventType === "asset") {
    if (event.payload.kind !== "asset") {
      addFieldError(fieldErrors, warnings, "payload", "Missing asset payload.");
      return { ops, warnings, fieldErrors };
    }

    const payload = event.payload.data;

    if (!payload.name?.trim()) {
      addFieldError(fieldErrors, warnings, "name", "Asset name is required.");
    }
    if (!Number.isFinite(payload.currentValue) || payload.currentValue < 0) {
      addFieldError(fieldErrors, warnings, "currentValue", "Asset value must be zero or more.");
    }
    if (payload.startMonth && !isValidMonthKey(payload.startMonth)) {
      addFieldError(fieldErrors, warnings, "startMonth", "Start month is invalid.");
    }

    if (Object.keys(fieldErrors).length === 0) {
      ops.push({
        action: "upsert",
        entity: "asset",
        item: {
          assetType: payload.assetType,
          name: payload.name.trim(),
          currentValue: payload.currentValue,
          currency: payload.currency || snapshot.baseCurrency,
          ownerMemberId: payload.ownerMemberId,
          startMonth: payload.startMonth ?? event.effectiveMonth,
          notes: payload.notes,
          source: "eventGenerated",
          generatedByEventId: event.id,
        },
      });
    }

    return { ops, warnings, fieldErrors };
  }

  if (event.eventType === "liability") {
    if (event.payload.kind !== "liability") {
      addFieldError(fieldErrors, warnings, "payload", "Missing liability payload.");
      return { ops, warnings, fieldErrors };
    }

    const payload = event.payload.data;

    if (!payload.name?.trim()) {
      addFieldError(fieldErrors, warnings, "name", "Liability name is required.");
    }
    if (!Number.isFinite(payload.principalOutstanding) || payload.principalOutstanding < 0) {
      addFieldError(
        fieldErrors,
        warnings,
        "principalOutstanding",
        "Principal must be zero or more."
      );
    }
    if (payload.interestRate !== undefined) {
      if (!Number.isFinite(payload.interestRate) || payload.interestRate < 0) {
        addFieldError(fieldErrors, warnings, "interestRate", "Interest rate is invalid.");
      }
    }
    if (payload.startMonth && !isValidMonthKey(payload.startMonth)) {
      addFieldError(fieldErrors, warnings, "startMonth", "Start month is invalid.");
    }
    if (payload.termMonths !== undefined) {
      if (!Number.isFinite(payload.termMonths) || payload.termMonths <= 0) {
        addFieldError(fieldErrors, warnings, "termMonths", "Term months is invalid.");
      }
    }

    if (Object.keys(fieldErrors).length === 0) {
      ops.push({
        action: "upsert",
        entity: "liability",
        item: {
          liabilityType: payload.liabilityType,
          name: payload.name.trim(),
          principalOutstanding: payload.principalOutstanding,
          currency: payload.currency || snapshot.baseCurrency,
          interestRate: payload.interestRate,
          startMonth: payload.startMonth ?? event.effectiveMonth,
          termMonths: payload.termMonths,
          notes: payload.notes,
          source: "eventGenerated",
          generatedByEventId: event.id,
        },
      });
    }

    return { ops, warnings, fieldErrors };
  }

  addFieldError(fieldErrors, warnings, "eventType", "Unsupported event type.");
  return { ops, warnings, fieldErrors };
};

