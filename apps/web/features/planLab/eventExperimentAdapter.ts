import { monthIndex } from "@north-star/engine";
import { ageToYYYYMM } from "../../src/utils/ageMonth";
import type { EventOverrideExperimentSpec } from "../../src/domain/planLab/eventOverrideExperiment";
import type { ScenarioMember } from "../../src/store/scenarioStore";
import type { ScenarioEvent } from "../../src/domain/scenarioV2/events";

export type EventExperimentDraftInput = {
  amountMode: "delta" | "set";
  deltaUnit: "percent" | "hkd";
  amountValue: number;
  setAmountValue: number | null;
  startMonthMode: "offset" | "month" | "age";
  startAgeYears: number;
  startAgeMonths: number;
  startShiftMonths: number;
  startMonthValue: string;
  endMonthMode: "offset" | "month" | "age";
  endAgeYears: number;
  endAgeMonths: number;
  endShiftMonths: number;
  endMonthValue: string;
  clearEndMonth: boolean;
  growthMode: "unchanged" | "assumption" | "custom" | "none";
  growthRate: number;
};

export const buildEventExperimentChanges = ({
  draft,
  baselineEvent,
  baseMonth,
  members,
}: {
  draft: EventExperimentDraftInput;
  baselineEvent: ScenarioEvent;
  baseMonth: string;
  members: ScenarioMember[];
}): Pick<EventOverrideExperimentSpec, "changes" | "uiMetadata"> => {
  const baselineStartMonth =
    baselineEvent.type === "cashflow" ? baselineEvent.startMonth ?? baseMonth : baseMonth;
  const baselineEndMonth = baselineEvent.type === "cashflow" ? baselineEvent.endMonth ?? null : null;
  const memberBirthMonth = baselineEvent.memberId
    ? members.find((member) => member.id === baselineEvent.memberId)?.birthMonth
    : undefined;

  const resolvedStartMonth =
    draft.startMonthMode === "month"
      ? draft.startMonthValue || baselineStartMonth
      : draft.startMonthMode === "age"
      ? ageToYYYYMM(memberBirthMonth ?? "", draft.startAgeYears * 12 + draft.startAgeMonths) ?? baselineStartMonth
      : baselineStartMonth;

  const resolvedEndMonth =
    draft.endMonthMode === "month"
      ? draft.clearEndMonth
        ? null
        : draft.endMonthValue || baselineEndMonth
      : draft.endMonthMode === "age"
      ? ageToYYYYMM(memberBirthMonth ?? "", draft.endAgeYears * 12 + draft.endAgeMonths)
      : baselineEndMonth;

  const startMonthShift =
    draft.startMonthMode === "offset"
      ? draft.startShiftMonths
      : monthIndex(baselineStartMonth, resolvedStartMonth);

  const endMonthShift =
    draft.endMonthMode === "offset" && baselineEndMonth ? draft.endShiftMonths : undefined;

  return {
    changes: {
      amountSet:
        draft.amountMode === "set" && typeof draft.setAmountValue === "number"
          ? draft.setAmountValue
          : undefined,
      amountMultiplier:
        draft.amountMode === "delta" && draft.deltaUnit === "percent"
          ? 1 + draft.amountValue / 100
          : undefined,
      amountDelta:
        draft.amountMode === "delta" && draft.deltaUnit === "hkd" ? draft.amountValue : undefined,
      startMonthShift: startMonthShift !== 0 ? startMonthShift : undefined,
      startMonth:
        draft.startMonthMode !== "offset" && resolvedStartMonth !== baselineStartMonth
          ? resolvedStartMonth
          : undefined,
      endMonthShift: endMonthShift !== 0 ? endMonthShift : undefined,
      endMonth: draft.endMonthMode !== "offset" ? resolvedEndMonth : undefined,
      growthMode: draft.growthMode === "unchanged" ? undefined : draft.growthMode,
      growthRate: draft.growthMode === "custom" ? draft.growthRate : undefined,
    },
    uiMetadata: {
      startTimingMode: draft.startMonthMode,
      endTimingMode: draft.endMonthMode,
      startAgeYears: draft.startMonthMode === "age" ? draft.startAgeYears : undefined,
      startAgeMonths: draft.startMonthMode === "age" ? draft.startAgeMonths : undefined,
      endAgeYears: draft.endMonthMode === "age" ? draft.endAgeYears : undefined,
      endAgeMonths: draft.endMonthMode === "age" ? draft.endAgeMonths : undefined,
    },
  };
};
