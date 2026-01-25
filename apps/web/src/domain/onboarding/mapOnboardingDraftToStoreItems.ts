import { nanoid } from "nanoid";
import type { ApplyScope } from "../applyScope";
import type { EventDefinition, ScenarioEventRef } from "../events/types";
import type { OnboardingDraft } from "../onboardingDraft/types";
import {
  createBudgetRuleId,
  createHomePositionId,
  createMemberId,
  type BudgetRule,
  type HomePositionDraft,
  type ScenarioMember,
} from "../../store/scenarioStore";
import { normalizeMonthStrict } from "../../utils/month";

export const ONBOARDING_PLACEHOLDER_TAG = "[PLACEHOLDER]";

type OnboardingDraftMappingError = {
  field: string;
  reason: "invalid-month";
  message: string;
  blocking?: boolean;
};

export type OnboardingDraftStoreChanges = {
  globalChanges: {
    members: ScenarioMember[];
    budgetRules: BudgetRule[];
  };
  scenarioChanges: {
    eventDefinitions: EventDefinition[];
    eventRefs: ScenarioEventRef[];
    homePositions: HomePositionDraft[];
    initialCash?: number;
  };
  errors: OnboardingDraftMappingError[];
};

const DEFAULT_MEMBER_NAME = "主要成員";

const clampNonNegative = (value: number) => Math.max(0, value);

const toNumber = (value: number | null | undefined, fallback = 0) => {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const buildPlaceholderTitle = (label: string) => `${ONBOARDING_PLACEHOLDER_TAG} ${label}`;

const buildApplyScope = (scenarioId: string): ApplyScope => ({
  scope: "include",
  scenarioIds: [scenarioId],
});

const normalizeMonthOrError = (
  field: string,
  value: string | null | undefined,
  errors: OnboardingDraftMappingError[]
): string | null => {
  if (!value) {
    return null;
  }
  const normalized = normalizeMonthStrict(value);
  if (!normalized.ok) {
    errors.push({
      field,
      reason: "invalid-month",
      message: `${field} has invalid month ${value}.`,
    });
    return null;
  }
  return normalized.month;
};

const buildEventId = (scenarioId: string, suffix: string) =>
  `onboarding-draft:${scenarioId}:${suffix}:${nanoid(6)}`;

export const mapOnboardingDraftToStoreItems = ({
  draft,
  baseMonth,
  scenarioId,
  members,
}: {
  draft: OnboardingDraft;
  baseMonth: string;
  scenarioId: string;
  members: ScenarioMember[];
}): OnboardingDraftStoreChanges => {
  const errors: OnboardingDraftMappingError[] = [];
  const normalizedBase = normalizeMonthStrict(baseMonth);
  if (!normalizedBase.ok) {
    return {
      globalChanges: { members: [], budgetRules: [] },
      scenarioChanges: { eventDefinitions: [], eventRefs: [], homePositions: [] },
      errors: [
        {
          field: "baseMonth",
          reason: "invalid-month",
          message: `baseMonth has invalid month ${baseMonth}.`,
          blocking: true,
        },
      ],
    };
  }

  const applyScope = buildApplyScope(scenarioId);
  const existingMemberIds = new Set(members.map((member) => member.id));
  const normalizedMembers: ScenarioMember[] = draft.members.map((member, index) => {
    const fallbackName = index === 0 ? DEFAULT_MEMBER_NAME : `成員 ${index + 1}`;
    return {
      id: member.id,
      name: member.name?.trim() || fallbackName,
      kind: "person" as const,
      birthMonth: undefined,
      ageAtBaseMonth:
        typeof member.ageAtBaseMonth === "number" ? member.ageAtBaseMonth : undefined,
      applyScope,
      milestones: [],
    };
  });
  const membersToCreate: ScenarioMember[] = normalizedMembers.filter(
    (member) => !existingMemberIds.has(member.id)
  );
  const primaryMemberId = normalizedMembers[0]?.id ?? members[0]?.id;

  const eventDefinitions: EventDefinition[] = [];
  const eventRefs: ScenarioEventRef[] = [];
  const homePositions: HomePositionDraft[] = [];
  const budgetRules: BudgetRule[] = [];

  const addEvent = (definition: EventDefinition) => {
    eventDefinitions.push(definition);
    eventRefs.push({ refId: definition.id, enabled: true });
  };

  const incomeMonthly = clampNonNegative(
    toNumber(draft.baseline.monthlyIncomeTotal)
  );
  if (incomeMonthly > 0) {
    addEvent({
      id: buildEventId(scenarioId, "income"),
      title: buildPlaceholderTitle("Total income"),
      type: "salary",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth: normalizedBase.month,
        endMonth: null,
        monthlyAmount: incomeMonthly,
        oneTimeAmount: 0,
        annualGrowthPct: 0,
      },
      memberId: primaryMemberId,
      incomeSubtype: "salary",
    });
  }

  let expenseMonthly = clampNonNegative(
    toNumber(draft.baseline.monthlyExpenseTotal)
  );

  if (draft.microPlan.kind === "housing" && draft.microPlan.housing.kind === "rent") {
    const startMonth = normalizeMonthOrError(
      "housing.startMonth",
      draft.microPlan.housing.startMonth,
      errors
    );
    if (startMonth) {
      const rentMonthly = clampNonNegative(
        toNumber(draft.microPlan.housing.monthlyRent)
      );
      if (rentMonthly > 0) {
        addEvent({
          id: buildEventId(scenarioId, "rent"),
          title: "Rent",
          type: "rent",
          kind: "cashflow",
          rule: {
            mode: "params",
            startMonth,
            endMonth: null,
            monthlyAmount: rentMonthly,
            oneTimeAmount: 0,
            annualGrowthPct: 0,
          },
        });
        expenseMonthly = Math.max(0, expenseMonthly - rentMonthly);
      }
    }
  }

  if (expenseMonthly > 0) {
    addEvent({
      id: buildEventId(scenarioId, "expenses"),
      title: buildPlaceholderTitle("Total expenses"),
      type: "custom",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth: normalizedBase.month,
        endMonth: null,
        monthlyAmount: expenseMonthly,
        oneTimeAmount: 0,
        annualGrowthPct: 0,
      },
    });
  }

  if (draft.microPlan.kind === "housing" && draft.microPlan.housing.kind === "buy") {
    const purchaseMonth = normalizeMonthOrError(
      "housing.purchaseMonth",
      draft.microPlan.housing.purchaseMonth,
      errors
    );
    if (purchaseMonth) {
      const purchasePrice = clampNonNegative(
        toNumber(draft.microPlan.housing.purchasePrice)
      );
      const downPaymentAmount =
        typeof draft.microPlan.housing.downPaymentAmount === "number"
          ? clampNonNegative(toNumber(draft.microPlan.housing.downPaymentAmount))
          : typeof draft.microPlan.housing.downPaymentPct === "number"
            ? clampNonNegative(
                purchasePrice *
                  (toNumber(draft.microPlan.housing.downPaymentPct) / 100)
              )
            : 0;
      const mortgageRatePct = toNumber(draft.microPlan.housing.mortgageRatePct);
      const mortgageTermYears = toNumber(draft.microPlan.housing.termYears);
      homePositions.push({
        id: createHomePositionId(),
        usage: "primary",
        mode: "new_purchase",
        purchaseMonth,
        purchasePrice,
        downPayment: downPaymentAmount,
        annualAppreciationPct: 0,
        mortgageRatePct,
        mortgageTermYears,
        feesOneTime: 0,
        holdingCostMonthly: 0,
        holdingCostAnnualGrowthPct: 0,
      });
    }
  }

  if (draft.microPlan.kind === "baby") {
    const dueMonth = normalizeMonthOrError(
      "baby.dueMonth",
      draft.microPlan.baby.dueMonth,
      errors
    );
    if (dueMonth) {
      const babyMemberId = createMemberId();
      membersToCreate.push({
        id: babyMemberId,
        name: "小朋友",
        kind: "person",
        birthMonth: dueMonth,
        applyScope,
        milestones: [],
      });

      const monthlyBudget = clampNonNegative(
        toNumber(draft.microPlan.baby.monthlyBudget)
      );
      if (monthlyBudget > 0) {
        budgetRules.push({
          id: createBudgetRuleId(),
          name: "Baby budget",
          enabled: true,
          memberId: babyMemberId,
          category: "childcare",
          ageBand: { fromYears: 0, toYears: 99 },
          monthlyAmount: monthlyBudget,
          annualGrowthPct: 0,
          startMonth: dueMonth,
          applyScope,
        });
      }

      const oneOffCost = clampNonNegative(toNumber(draft.microPlan.baby.oneOffCost));
      if (oneOffCost > 0) {
        addEvent({
          id: buildEventId(scenarioId, "baby-one-off"),
          title: "Baby one-off",
          type: "baby",
          kind: "cashflow",
          rule: {
            mode: "params",
            startMonth: dueMonth,
            endMonth: dueMonth,
            monthlyAmount: 0,
            oneTimeAmount: oneOffCost,
            annualGrowthPct: 0,
          },
          memberId: babyMemberId,
        });
      }
    }
  }

  const initialCashValue = clampNonNegative(toNumber(draft.baseline.initialCash));

  return {
    globalChanges: { members: membersToCreate, budgetRules },
    scenarioChanges: {
      eventDefinitions,
      eventRefs,
      homePositions,
      initialCash:
        Number.isFinite(initialCashValue) && initialCashValue > 0
          ? initialCashValue
          : undefined,
    },
    errors,
  };
};
