import { addMonths, monthIndex } from "@north-star/engine";
import { nanoid } from "nanoid";
import type { EventDefinition, ScenarioEventRef } from "../../src/domain/events/types";
import type { ScenarioEventDraft } from "../moneyFlow/CashflowEventDrawer";

type BuildPlanLabEventFromCashflowDraftParams = {
  draft: ScenarioEventDraft;
  baseCurrency: string;
  baseMonth?: string | null;
  horizonMonths?: number;
  createId?: () => string;
};

const DEFAULT_HORIZON_MONTHS = 120;

const buildRecurringSchedule = (params: {
  startMonth: string;
  endMonth?: string;
  cadence: "quarterly" | "yearly" | "everyNMonths";
  everyNMonths?: string;
  amount: number;
  baseMonth?: string | null;
  horizonMonths?: number;
}) => {
  const { startMonth, endMonth, cadence, everyNMonths, amount, baseMonth, horizonMonths } =
    params;
  const interval =
    cadence === "quarterly" ? 3 : cadence === "yearly" ? 12 : Number(everyNMonths) || 1;
  const maxMonths = Math.max(1, horizonMonths ?? DEFAULT_HORIZON_MONTHS);
  const fallbackEndMonth = addMonths(startMonth, maxMonths - 1);
  const cappedEndMonth = endMonth || fallbackEndMonth;
  const effectiveEndMonth =
    baseMonth && Number.isFinite(monthIndex(baseMonth, cappedEndMonth))
      ? addMonths(baseMonth, Math.min(maxMonths - 1, monthIndex(baseMonth, cappedEndMonth)))
      : cappedEndMonth;

  const schedule: Array<{ month: string; amount: number }> = [];
  for (let offset = 0; offset <= maxMonths; offset += interval) {
    const month = addMonths(startMonth, offset);
    if (month > effectiveEndMonth) {
      break;
    }
    schedule.push({ month, amount });
  }
  return schedule;
};

export const buildPlanLabEventFromCashflowDraft = ({
  draft,
  baseCurrency,
  baseMonth,
  horizonMonths,
  createId,
}: BuildPlanLabEventFromCashflowDraftParams): { definition: EventDefinition; ref: ScenarioEventRef } | null => {
  if (draft.type !== "cashflow") {
    return null;
  }

  const amount = Number(draft.amount);
  const nextId = createId?.() ?? `planlab_evt_${nanoid(8)}`;
  const title = draft.label.trim() || (draft.kind === "income" ? "Income" : "Expense");
  const type = draft.kind === "income" ? "salary" : "custom";

  const scheduleCadence =
    draft.cadence === "quarterly" ||
    draft.cadence === "yearly" ||
    draft.cadence === "everyNMonths"
      ? draft.cadence
      : null;

  const rule =
    draft.cadence === "oneOff"
      ? {
          mode: "params" as const,
          startMonth: draft.occurrenceMonth,
          endMonth: null,
          monthlyAmount: 0,
          oneTimeAmount: amount,
          annualGrowthPct: 0,
        }
      : scheduleCadence
        ? {
            mode: "schedule" as const,
            startMonth: draft.startMonth,
            endMonth: draft.endMonth || null,
            monthlyAmount: undefined,
            oneTimeAmount: 0,
            annualGrowthPct: 0,
            schedule: buildRecurringSchedule({
              startMonth: draft.startMonth,
              endMonth: draft.endMonth || undefined,
              cadence: scheduleCadence,
              everyNMonths: draft.everyNMonths,
              amount,
              baseMonth,
              horizonMonths,
            }),
          }
        : {
            mode: "params" as const,
            startMonth: draft.startMonth,
            endMonth: draft.endMonth || null,
            monthlyAmount: amount,
            oneTimeAmount: 0,
            annualGrowthPct: 0,
          };

  return {
    definition: {
      id: nextId,
      title,
      type,
      kind: "cashflow",
      currency: baseCurrency,
      memberId: draft.memberId || undefined,
      incomeSubtype: type === "salary" ? "salary" : undefined,
      rule,
    },
    ref: {
      refId: nextId,
      enabled: true,
      highlighted: false,
    },
  };
};

