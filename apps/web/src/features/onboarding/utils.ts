import type { Scenario } from "../../store/scenarioStore";
import { addMonths, monthsBetween } from "../../domain/members/age";
import { isValidMonthStr } from "../../utils/month";

export const buildOnboardingEventId = (scenarioId: string, key: string) =>
  `onboarding-${scenarioId}-${key}`;

export const buildOnboardingPositionId = (scenarioId: string, key: string) =>
  `onboarding-${scenarioId}-${key}`;

export const buildOnboardingMemberId = (scenarioId: string, key: string) =>
  `onboarding-${scenarioId}-${key}`;

export const buildOnboardingBudgetRuleId = (
  scenarioId: string,
  category: string,
  memberId?: string
) =>
  `onboarding-${scenarioId}-${category}${memberId ? `-${memberId}` : ""}`;

export const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

export const clampToYearMonth = (value: string) =>
  isValidMonthStr(value) ? value : null;

export const computeEndMonthFromDuration = (
  startMonth: string,
  durationYears?: number | null
) => {
  if (!durationYears || durationYears <= 0) {
    return null;
  }
  const months = Math.round(durationYears * 12);
  if (!isValidMonthStr(startMonth) || months <= 0) {
    return null;
  }
  return addMonths(startMonth, months - 1);
};

export const computeDurationYears = (startMonth: string, endMonth?: string | null) => {
  if (!startMonth || !endMonth) {
    return undefined;
  }
  if (!isValidMonthStr(startMonth) || !isValidMonthStr(endMonth)) {
    return undefined;
  }
  const months = monthsBetween(startMonth, endMonth) + 1;
  if (months <= 0) {
    return undefined;
  }
  return Math.round((months / 12) * 10) / 10;
};

export const getBaseMonth = (scenario: Scenario) =>
  scenario.assumptions.baseMonth ?? getCurrentMonth();
