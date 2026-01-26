"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { addMonths } from "../../src/domain/members/age";
import type {
  FamilyLaunchDraft,
  PlanLabGoalType,
} from "../../src/domain/planLab/types";
import { normalizeMonthStrict } from "../../src/utils/month";
import type { Scenario } from "../../src/store/scenarioStore";

const parseNumberParam = (value: string | null) => {
  if (!value) {
    return undefined;
  }
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
};

const parseMonthParam = (value: string | null) => {
  if (!value) {
    return undefined;
  }
  const normalized = normalizeMonthStrict(value);
  return normalized.ok ? normalized.month : undefined;
};

const buildDefaultMonth = (baseMonth: string | null, offset: number) => {
  if (!baseMonth) {
    return undefined;
  }
  return addMonths(baseMonth, offset);
};

export type PlanLabDeepLinkState = {
  goalType: PlanLabGoalType;
  familyLaunchDraft: FamilyLaunchDraft;
  openPanel: boolean;
};

export const usePlanLabDeepLink = (scenario: Scenario | null): PlanLabDeepLinkState => {
  const searchParams = useSearchParams();

  return useMemo(() => {
    const goalParam = searchParams.get("goal");
    const goalType: PlanLabGoalType =
      goalParam === "classic" ? "classic" : "family-launch";
    const baseMonthRaw = scenario?.assumptions.baseMonth ?? null;
    const normalizedBaseMonth = baseMonthRaw
      ? normalizeMonthStrict(baseMonthRaw)
      : null;
    const baseMonth = normalizedBaseMonth?.ok ? normalizedBaseMonth.month : null;

    const weddingMonth =
      parseMonthParam(searchParams.get("weddingMonth")) ??
      buildDefaultMonth(baseMonth, 3);
    const dueMonth =
      parseMonthParam(searchParams.get("dueMonth")) ??
      buildDefaultMonth(baseMonth, 9);
    const purchaseMonth =
      parseMonthParam(searchParams.get("purchaseMonth")) ??
      buildDefaultMonth(baseMonth, 12);

    const housingModeParam = searchParams.get("housingMode");
    const housingMode =
      housingModeParam === "buy-home" ||
      housingModeParam === "rent-upgrade" ||
      housingModeParam === "keep-rent"
        ? housingModeParam
        : "buy-home";

    const familyLaunchDraft: FamilyLaunchDraft = {
      wedding: {
        weddingMonth,
        weddingBudget: parseNumberParam(searchParams.get("weddingBudget")),
        honeymoonBudget: parseNumberParam(searchParams.get("honeymoonBudget")),
      },
      baby: {
        dueMonth,
        babyMonthlyBudget: parseNumberParam(searchParams.get("babyMonthlyBudget")),
        babyOneOffBudget: parseNumberParam(searchParams.get("babyOneOffBudget")),
        babyDurationMonths: parseNumberParam(searchParams.get("babyDurationMonths")) ?? 24,
      },
      housing: {
        housingMode,
        rentStartMonth: parseMonthParam(searchParams.get("rentStartMonth")),
        currentRent: parseNumberParam(searchParams.get("currentRent")),
        upgradedRent: parseNumberParam(searchParams.get("upgradedRent")),
        purchaseMonth,
        homePrice: parseNumberParam(searchParams.get("homePrice")),
        downPaymentAmount: parseNumberParam(searchParams.get("downPaymentAmount")),
        downPaymentPct: parseNumberParam(searchParams.get("downPaymentPct")),
        mortgageRatePct: parseNumberParam(searchParams.get("mortgageRatePct")),
        mortgageTermYears: parseNumberParam(searchParams.get("mortgageTermYears")),
        oneOffFees: parseNumberParam(searchParams.get("oneOffFees")),
        monthlyHoldingCost: parseNumberParam(searchParams.get("monthlyHoldingCost")),
        annualAppreciationPct: parseNumberParam(searchParams.get("annualAppreciationPct")),
      },
    };

    const openPanel =
      goalParam === "family-launch" ||
      Boolean(
        searchParams.get("purchaseMonth") ||
          searchParams.get("dueMonth") ||
          searchParams.get("weddingMonth")
      );

    return {
      goalType,
      familyLaunchDraft,
      openPanel,
    };
  }, [scenario?.assumptions.baseMonth, searchParams]);
};
