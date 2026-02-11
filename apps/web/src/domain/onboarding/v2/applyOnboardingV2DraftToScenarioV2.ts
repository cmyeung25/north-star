import { defaultCurrency } from "../../../../lib/i18n";
import { resolvePlanningHorizonMonths } from "../../assumptions/planningHorizon";
import { addMonths, monthsBetween } from "../../members/age";
import type {
  Scenario,
  ScenarioAsset,
  ScenarioLiability,
  ScenarioMember,
  ScenarioAssumptions,
} from "../../../store/scenarioStore";
import { compareMonthKey, isValidMonthKey } from "../../../utils/monthKey";
import type {
  CashflowEvent,
  HousingEvent,
  InsuranceEvent,
  LoanEvent,
  ScenarioEvent,
} from "../../scenarioV2/events";
import { computeMonthlyPayment } from "../../positions/calculations";
import {
  type OnboardingV2Draft,
  type OnboardingV2DraftDebt,
  type OnboardingV2DraftHousing,
  type OnboardingV2DraftIncome,
  type OnboardingV2DraftInsurance,
  type OnboardingV2DraftLivingSpend,
  type OnboardingV2DraftMember,
  type OnboardingV2LivingSpendCategoryKey,
} from "./draftTypes";
import { buildAssumptionsPatch } from "./assumptions";

export const ONBOARDING_V2_PREFIX = "onboarding-v2";
const ONBOARDING_MEMBER_ID = /^(self|partner|child-\d+|pet-\d+)$/;

export const isOnboardingMemberId = (id: string) => ONBOARDING_MEMBER_ID.test(id);

const normalizeCurrency = (currency?: string) => {
  const trimmed = currency?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : defaultCurrency;
};

const normalizeMonth = (value?: string) =>
  value && isValidMonthKey(value) ? value : undefined;

const normalizeMemberId = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const normalizeAmount = (value: number | null | undefined) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeOptionalNumber = (value: number | null | undefined) => {
  const numeric = Number(value ?? NaN);
  return Number.isFinite(numeric) ? numeric : null;
};

const resolveRecurringEndMonth = ({
  startMonth,
  endMonth,
}: {
  startMonth: string;
  endMonth?: string;
}) => {
  if (!endMonth) {
    return undefined;
  }
  if (compareMonthKey(endMonth, startMonth) < 0) {
    return startMonth;
  }
  return endMonth;
};

const buildOnboardingEntityId = (scenarioId: string, group: string, key: string) =>
  `${ONBOARDING_V2_PREFIX}-${scenarioId}-${group}-${key}`;

const buildOnboardingEventId = (scenarioId: string, key: string) =>
  buildOnboardingEntityId(scenarioId, "event", key);

const buildHousingEntityId = (scenarioId: string, key: string) =>
  buildOnboardingEntityId(scenarioId, "housing", key);

const buildAssetsEntityId = (scenarioId: string, key: string) =>
  buildOnboardingEntityId(scenarioId, "assets", key);

const buildDebtsEntityId = (scenarioId: string, key: string) =>
  buildOnboardingEntityId(scenarioId, "debts", key);

const buildInsuranceEntityId = (scenarioId: string, key: string) =>
  buildOnboardingEntityId(scenarioId, "insurance", key);

const buildApplyScope = (scenarioId: string) => ({
  scope: "include" as const,
  scenarioIds: [scenarioId],
});

const parseIndexedName = (id: string) => {
  const match = /-(\d+)$/.exec(id);
  if (!match) {
    return null;
  }
  const index = Number(match[1]);
  return Number.isFinite(index) ? index : null;
};

const fallbackMemberName = (member: OnboardingV2DraftMember) => {
  switch (member.role) {
    case "partner":
      return "伴侶";
    case "child": {
      const index = parseIndexedName(member.id);
      return `子女 ${index ?? ""}`.trim();
    }
    case "pet": {
      const index = parseIndexedName(member.id);
      return `寵物 ${index ?? ""}`.trim();
    }
    case "self":
    default:
      return "主要成員";
  }
};

const normalizeDraftMembers = (members: OnboardingV2DraftMember[]) => {
  const ordered: OnboardingV2DraftMember[] = [];
  const seen = new Set<string>();

  members.forEach((member) => {
    if (!member?.id || seen.has(member.id)) {
      return;
    }
    seen.add(member.id);
    ordered.push(member);
  });

  if (!seen.has("self")) {
    ordered.unshift({ id: "self", role: "self" });
  }

  return ordered;
};

const PRIMARY_PLACEHOLDER_NAMES = new Set(["主要成員", "本人", "你", "您", "我"]);

const isPlaceholderPrimaryMember = (member: ScenarioMember) => {
  if (member.kind !== "person") {
    return false;
  }
  const normalizedName = member.name.trim();
  if (!PRIMARY_PLACEHOLDER_NAMES.has(normalizedName)) {
    return false;
  }
  if (member.birthMonth || typeof member.ageAtBaseMonth === "number") {
    return false;
  }
  return (member.milestones ?? []).length === 0;
};

const ensureSinglePrimaryMember = ({
  members,
  primaryMemberId,
}: {
  members: ScenarioMember[];
  primaryMemberId: string;
}) => {
  const seen = new Set<string>();
  const deduped = [...members]
    .reverse()
    .filter((member) => {
      if (seen.has(member.id)) {
        return false;
      }
      seen.add(member.id);
      return true;
    })
    .reverse();

  return deduped.filter((member) => {
    if (member.id === primaryMemberId) {
      return true;
    }
    if (member.id === "self") {
      return false;
    }
    return !isPlaceholderPrimaryMember(member);
  });
};

const resolvePrimaryMemberId = ({
  existingMembers,
  normalizedMembers,
}: {
  existingMembers: ScenarioMember[];
  normalizedMembers: OnboardingV2DraftMember[];
}) => {
  if (existingMembers.some((member) => member.id === "self")) {
    return "self";
  }

  const placeholderPrimaryMember = existingMembers.find(isPlaceholderPrimaryMember);
  if (placeholderPrimaryMember) {
    return placeholderPrimaryMember.id;
  }

  const draftPrimary = normalizedMembers.find((member) => member.id === "self");
  if (!draftPrimary) {
    return "self";
  }

  const draftName = draftPrimary.name?.trim();
  const draftBirthMonth = normalizeMonth(draftPrimary.birthMonth);
  const matchingPrimary = existingMembers.find((member) => {
    if (isOnboardingMemberId(member.id) || member.kind !== "person") {
      return false;
    }
    if (draftName && member.name.trim() !== draftName) {
      return false;
    }
    if (draftBirthMonth && member.birthMonth !== draftBirthMonth) {
      return false;
    }
    return Boolean(draftName || draftBirthMonth);
  });

  return matchingPrimary?.id ?? "self";
};

const buildIncomeEvents = ({
  incomes,
  scenarioId,
  baseMonth,
}: {
  incomes: OnboardingV2DraftIncome[];
  scenarioId: string;
  baseMonth?: string;
}): CashflowEvent[] => {
  const events: CashflowEvent[] = [];

  incomes.forEach((income) => {
    const label = income.label?.trim();
    if (!label) {
      return;
    }
    const amount = normalizeAmount(income.amount);
    if (amount <= 0) {
      return;
    }

    const resolvedStart = normalizeMonth(income.startMonth) ?? baseMonth;
    if (!resolvedStart) {
      return;
    }

    const growthMode: CashflowEvent["growthMode"] =
      income.followIncomeGrowth && income.frequency !== "oneOff"
        ? "assumption"
        : "none";
    const eventBase = {
      id: buildOnboardingEventId(scenarioId, `income-${income.id}`),
      type: "cashflow" as const,
      kind: "income" as const,
      amount,
      label,
      memberId: normalizeMemberId(income.memberId),
      growthMode,
    };

    if (income.frequency === "oneOff") {
      events.push({
        ...eventBase,
        cadence: "oneOff",
        occurrenceMonth: resolvedStart,
      });
      return;
    }

    const cadence =
      income.frequency === "monthly"
        ? "monthly"
        : income.frequency === "quarterly"
        ? "quarterly"
        : "yearly";

    events.push({
      ...eventBase,
      cadence,
      startMonth: resolvedStart,
      endMonth: resolveRecurringEndMonth({
        startMonth: resolvedStart,
        endMonth: normalizeMonth(income.endMonth),
      }),
    });
  });

  return events;
};

const buildLivingSpendEvents = ({
  livingSpend,
  scenarioId,
  baseMonth,
  horizonEnd,
}: {
  livingSpend: OnboardingV2DraftLivingSpend;
  scenarioId: string;
  baseMonth?: string;
  horizonEnd?: string;
}): CashflowEvent[] => {
  const events: CashflowEvent[] = [];
  const fixedStart =
    normalizeMonth(livingSpend.fixed.startMonth) ?? baseMonth ?? "";
  if (!fixedStart) {
    return events;
  }

  const fixedEnd = resolveRecurringEndMonth({
    startMonth: fixedStart,
    endMonth: normalizeMonth(livingSpend.fixed.endMonth),
  });

  const addMonthlyExpense = ({
    id,
    amount,
    label,
    startMonth,
    endMonth,
  }: {
    id: string;
    amount: number;
    label: string;
    startMonth: string;
    endMonth?: string;
  }) => {
    if (amount <= 0) {
      return;
    }
    events.push({
      id,
      type: "cashflow",
      kind: "expense",
      cadence: "monthly",
      amount,
      label,
      growthMode: "assumption",
      growthSource: "inflation",
      startMonth,
      endMonth,
    });
  };

  if (!livingSpend.categoryBreakdown.enabled) {
    addMonthlyExpense({
      id: buildOnboardingEventId(scenarioId, "living-fixed"),
      amount: normalizeAmount(livingSpend.fixed.amount),
      label: "Living expenses",
      startMonth: fixedStart,
      endMonth: fixedEnd,
    });
  }

  addMonthlyExpense({
    id: buildOnboardingEventId(scenarioId, "living-variable"),
    amount: normalizeAmount(livingSpend.variable.amount),
    label: "Variable spending",
    startMonth: fixedStart,
    endMonth: fixedEnd,
  });

  if (livingSpend.categoryBreakdown.enabled) {
    const categoryLabels: Record<OnboardingV2LivingSpendCategoryKey, string> = {
      food: "Food",
      transport: "Transport",
      entertainment: "Entertainment",
      medical: "Medical",
      education: "Education",
      misc: "Misc",
    };
    (Object.keys(categoryLabels) as OnboardingV2LivingSpendCategoryKey[]).forEach(
      (key) => {
        addMonthlyExpense({
          id: buildOnboardingEventId(scenarioId, `living-category-${key}`),
          amount: normalizeAmount(livingSpend.categoryBreakdown.categories[key]),
          label: categoryLabels[key],
          startMonth: fixedStart,
          endMonth: fixedEnd,
        });
      }
    );
  }

  const annualExpenses = [
    {
      key: "travel",
      label: "Travel",
      draft: livingSpend.travel,
    },
    {
      key: "tax",
      label: "Tax",
      draft: livingSpend.tax,
    },
  ];

  annualExpenses.forEach(({ key, label, draft }) => {
    if (draft.mode === "monthly") {
      addMonthlyExpense({
        id: buildOnboardingEventId(scenarioId, `living-${key}-monthly`),
        amount: normalizeAmount(draft.monthlyAmount),
        label,
        startMonth: fixedStart,
        endMonth: fixedEnd,
      });
      return;
    }

    const annualAmount = normalizeAmount(draft.annualAmount);
    const startMonths = Array.from(
      new Set(draft.months.filter((month) => isValidMonthKey(month)))
    );
    if (annualAmount <= 0 || startMonths.length === 0) {
      return;
    }
    const perMonthAmount = annualAmount / startMonths.length;
    startMonths.forEach((startMonth) => {
      const endMonth = horizonEnd;
      events.push({
        id: buildOnboardingEventId(
          scenarioId,
          `living-${key}-${startMonth}`
        ),
        type: "cashflow",
        kind: "expense",
        cadence: "yearly",
        amount: perMonthAmount,
        label,
        startMonth,
        endMonth,
      });
    });
  });

  livingSpend.otherFixed.forEach((item) => {
    const label = item.label?.trim();
    if (!label) {
      return;
    }
    const amount = normalizeAmount(item.amount);
    if (amount <= 0) {
      return;
    }
    const startMonth = normalizeMonth(item.startMonth) ?? fixedStart;
    const endMonth = resolveRecurringEndMonth({
      startMonth,
      endMonth: normalizeMonth(item.endMonth),
    });
    addMonthlyExpense({
      id: buildOnboardingEventId(scenarioId, `living-other-${item.id}`),
      amount,
      label,
      startMonth,
      endMonth,
    });
  });

  return events;
};

const buildHousingChanges = ({
  housing,
  scenarioId,
  baseMonth,
  inflationRate,
}: {
  housing: OnboardingV2DraftHousing;
  scenarioId: string;
  baseMonth?: string;
  inflationRate: number;
}): { assets: ScenarioAsset[]; liabilities: ScenarioLiability[]; events: HousingEvent[] } => {
  const assets: ScenarioAsset[] = [];
  const liabilities: ScenarioLiability[] = [];
  const events: HousingEvent[] = [];

  const propertyId = buildHousingEntityId(scenarioId, "property");
  const mortgageId = buildHousingEntityId(scenarioId, "mortgage");
  const resolvedBaseMonth = baseMonth ?? "";

  if (housing.mode === "rent") {
    if (housing.rent.noPayment) {
      return { assets, liabilities, events };
    }
    const amount = normalizeAmount(housing.rent.amount);
    const startMonth = normalizeMonth(housing.rent.startMonth) ?? resolvedBaseMonth;
    if (amount > 0 && startMonth) {
      events.push({
        id: buildOnboardingEventId(scenarioId, "housing-rent"),
        type: "housing",
        kind: "rent",
        startMonth,
        endMonth: resolveRecurringEndMonth({
          startMonth,
          endMonth: normalizeMonth(housing.rent.endMonth),
        }),
        rentMonthly: amount,
        rentAnnualGrowthPct:
          normalizeOptionalNumber(housing.rent.rentGrowthPct) ?? inflationRate,
        rentGrowthMode: "assumption",
        label: "Rent",
      });
    }
    return { assets, liabilities, events };
  }

  const propertyMarketValue = normalizeAmount(housing.own.propertyMarketValue);
  const mortgageBaseValue =
    housing.own.mortgageBaseMode === "CUSTOM"
      ? normalizeAmount(housing.own.mortgageBaseValue ?? propertyMarketValue)
      : propertyMarketValue;
  const propertyStartMonth =
    normalizeMonth(housing.own.startMonth) ?? resolvedBaseMonth;
  if (propertyMarketValue > 0 && propertyStartMonth) {
    assets.push({
      id: propertyId,
      kind: "home",
      label: "Property",
      currentValue: propertyMarketValue,
      startMonth: propertyStartMonth,
      source: "eventGenerated",
    });
  }

  const downPaymentPercent =
    housing.own.downPaymentMode === "percent"
      ? normalizeAmount(housing.own.downPaymentPercent)
      : propertyMarketValue > 0
        ? (normalizeAmount(housing.own.downPaymentAmount) / propertyMarketValue) * 100
        : 0;
  const downPaymentAmount =
    housing.own.downPaymentMode === "percent"
      ? (propertyMarketValue * downPaymentPercent) / 100
      : normalizeAmount(housing.own.downPaymentAmount);

  const mortgageTermYears = normalizeAmount(
    housing.own.mortgageTermYears ??
      (housing.own.mortgageTermMonths
        ? housing.own.mortgageTermMonths / 12
        : 0)
  );

  if (housing.own.mortgageEnabled && mortgageBaseValue > 0) {
    const principalOutstanding = Math.max(mortgageBaseValue - downPaymentAmount, 0);
    liabilities.push({
      id: mortgageId,
      kind: "mortgage",
      label: "Mortgage",
      principalOutstanding,
      annualInterestRatePct: normalizeAmount(housing.own.mortgageRatePct),
      termYears: mortgageTermYears || undefined,
      startMonth: propertyStartMonth ?? resolvedBaseMonth,
      source: "eventGenerated",
    });
  }

  if (!propertyStartMonth || propertyMarketValue <= 0 || !housing.own.mortgageEnabled) {
    return { assets, liabilities, events };
  }

  const event: HousingEvent = {
    id: buildOnboardingEventId(scenarioId, "housing-mortgage"),
    type: "housing",
    kind: "mortgage",
    startMonth: propertyStartMonth ?? resolvedBaseMonth,
    purchasePrice: propertyMarketValue,
    propertyMarketValue,
    mortgageBaseValue,
    mortgageBaseMode: housing.own.mortgageBaseMode ?? "SYNC",
    downPaymentMode: housing.own.downPaymentMode,
    downPaymentPercent,
    downPaymentAmount,
    mortgageRatePct: normalizeAmount(housing.own.mortgageRatePct),
    mortgageTermYears,
    mortgagePayment: normalizeOptionalNumber(housing.own.mortgagePayment) ?? undefined,
    feesOneOff: housing.own.fees.flatMap((fee) => {
      const label = fee.label?.trim();
      if (!label) {
        return [];
      }
      const amount = normalizeAmount(fee.amount);
      if (amount <= 0) {
        return [];
      }
      const month =
        normalizeMonth(fee.month) ?? propertyStartMonth ?? resolvedBaseMonth;
      if (!month) {
        return [];
      }
      return [{ id: fee.id, label, amount, month }];
    }),
    ongoingCosts: housing.own.ongoingCosts.flatMap((cost) => {
      const label = cost.label?.trim();
      if (!label) {
        return [];
      }
      const amount = normalizeAmount(cost.amount);
      if (amount <= 0) {
        return [];
      }
      const startMonth =
        normalizeMonth(cost.startMonth) ?? propertyStartMonth ?? resolvedBaseMonth;
      if (!startMonth) {
        return [];
      }
      return [
        {
          id: cost.id,
          label,
          amount,
          startMonth,
          endMonth: resolveRecurringEndMonth({
            startMonth,
            endMonth: normalizeMonth(cost.endMonth),
          }),
        },
      ];
    }),
    rental: housing.own.rental.enabled
      ? {
          enabled: true,
          rentMonthly: Math.max(
            0,
            normalizeAmount(housing.own.rental.amount) -
              normalizeAmount(housing.own.rental.discountAmount)
          ),
          startMonth:
            normalizeMonth(housing.own.rental.startMonth) ?? propertyStartMonth,
          endMonth: normalizeMonth(housing.own.rental.endMonth),
          rentGrowthMode: "assumption",
          rentAnnualGrowthPct: inflationRate,
        }
      : undefined,
    propertyAssetId: propertyId,
    mortgageLiabilityId: mortgageId,
    label: "Mortgage",
  };

  if (event.startMonth && isValidMonthKey(event.startMonth)) {
    events.push(event);
  }

  return { assets, liabilities, events };
};

const buildDebtEvents = ({
  debts,
  scenarioId,
  baseMonth,
}: {
  debts: OnboardingV2DraftDebt[];
  scenarioId: string;
  baseMonth?: string;
}): { liabilities: ScenarioLiability[]; events: LoanEvent[] } => {
  const liabilities: ScenarioLiability[] = [];
  const events: LoanEvent[] = [];

  debts.forEach((debt) => {
    const label = debt.label?.trim();
    const principal = normalizeAmount(debt.principalOutstanding);
    const startMonth = normalizeMonth(debt.startMonth) ?? baseMonth;
    if (!startMonth || principal <= 0) {
      return;
    }

    const termYears =
      normalizeOptionalNumber(debt.termYears) ??
      (() => {
        const normalizedMaturity = normalizeMonth(debt.maturityMonth);
        if (normalizedMaturity) {
          const months = monthsBetween(startMonth, normalizedMaturity) + 1;
          return months > 0 ? months / 12 : 0;
        }
        return 0;
      })();

    const interestRatePct = normalizeAmount(debt.interestRatePct);
    const liabilityId = buildDebtsEntityId(scenarioId, debt.id);
    const loanKind =
      debt.type === "carLoan"
        ? "car"
        : debt.type === "creditCard"
        ? "credit"
        : debt.type === "personalLoan"
        ? "personal"
        : "other";

    liabilities.push({
      id: liabilityId,
      kind:
        debt.type === "carLoan"
          ? "carLoan"
          : debt.type === "creditCard"
          ? "credit"
          : debt.type === "personalLoan"
          ? "loan"
          : "other",
      label: label || "Loan",
    });

    const termMonths = termYears ? Math.round(termYears * 12) : 0;
    const estimatedPayment =
      interestRatePct > 0 && termMonths > 0
        ? computeMonthlyPayment(principal, interestRatePct / 100, termMonths)
        : 0;
    const inputPayment = normalizeOptionalNumber(debt.monthlyPayment);
    const paymentAmount =
      inputPayment && inputPayment > 0
        ? inputPayment
        : estimatedPayment && estimatedPayment > 0
          ? estimatedPayment
          : undefined;

    const event: LoanEvent = {
      id: buildOnboardingEventId(scenarioId, `debt-${debt.id}`),
      type: "loan",
      loanKind,
      startMonth,
      principal,
      annualInterestRatePct: interestRatePct,
      termYears,
      monthlyPayment: paymentAmount,
      paymentMethod: paymentAmount
        ? inputPayment && inputPayment > 0
          ? "manual"
          : "amortization"
        : undefined,
      paymentIsEstimated: paymentAmount
        ? !(inputPayment && inputPayment > 0)
        : undefined,
      liabilityId,
      label: label || "Loan",
    };

    if (debt.type === "carLoan") {
      const purchasePrice = normalizeOptionalNumber(debt.purchasePrice);
      const downPaymentPercent =
        purchasePrice && purchasePrice > 0
          ? debt.downPaymentMode === "amount"
            ? (normalizeAmount(debt.downPaymentAmount) / purchasePrice) * 100
            : normalizeAmount(debt.downPaymentPercent)
          : undefined;
      const downPaymentAmount =
        debt.downPaymentMode === "amount"
          ? normalizeOptionalNumber(debt.downPaymentAmount) ?? undefined
          : purchasePrice && purchasePrice > 0
          ? (purchasePrice * normalizeAmount(debt.downPaymentPercent)) / 100
          : undefined;

      event.purchasePrice = purchasePrice ?? undefined;
      event.downPaymentMode = debt.downPaymentMode ?? undefined;
      event.downPaymentPercent = downPaymentPercent ?? undefined;
      event.downPaymentAmount = downPaymentAmount ?? undefined;
    }

    events.push(event);
  });

  return { liabilities, events };
};

const buildInsuranceChanges = ({
  insurance,
  scenarioId,
  baseMonth,
}: {
  insurance: OnboardingV2DraftInsurance;
  scenarioId: string;
  baseMonth?: string;
}): { assets: ScenarioAsset[]; events: InsuranceEvent[] } => {
  const assets: ScenarioAsset[] = [];
  const events: InsuranceEvent[] = [];

  if (insurance.mode === "quick") {
    const amount = normalizeAmount(insurance.quick.amount);
    const startMonth = normalizeMonth(insurance.quick.startMonth) ?? baseMonth;
    if (amount > 0 && startMonth) {
      events.push({
        id: buildOnboardingEventId(scenarioId, "insurance-quick"),
        type: "insurance",
        mode: "quick",
        startMonth,
        endMonth: resolveRecurringEndMonth({
          startMonth,
          endMonth: normalizeMonth(insurance.quick.endMonth),
        }),
        premiumMonthly: amount,
        premiumAnnualGrowthPct: 0,
        label: "Insurance premium",
      });
    }

    return { assets, events };
  }

  const policies = insurance.policies.flatMap((policy) => {
    const startMonth = normalizeMonth(policy.startMonth) ?? baseMonth;
    if (!startMonth) {
      return [];
    }

    const policyId = buildInsuranceEntityId(scenarioId, `policy-${policy.id}`);
    const policyAssetId = buildInsuranceEntityId(
      scenarioId,
      `policy-asset-${policy.id}`
    );

    if (policy.type === "savings") {
      const cashValue = normalizeOptionalNumber(policy.cashValue);
      if (cashValue && cashValue > 0) {
        assets.push({
          id: policyAssetId,
          kind: "policy",
          label: policy.name?.trim() || "Insurance cash value",
          ownerMemberId: normalizeMemberId(policy.memberId),
          currentValue: cashValue,
          startMonth,
          source: "eventGenerated",
        });
      }
    }

    return [
      {
        id: policy.id,
        name: policy.name?.trim() || "Insurance",
        kind: policy.type,
        startMonth,
        endMonth: resolveRecurringEndMonth({
          startMonth,
          endMonth: normalizeMonth(policy.endMonth),
        }),
        premiumMonthly: normalizeAmount(policy.premiumPerMonth),
        premiumAnnualGrowthPct: 0,
        cashValue:
          policy.type === "savings"
            ? normalizeOptionalNumber(policy.cashValue) ?? undefined
            : undefined,
        expectedAnnualReturnPct: normalizeOptionalNumber(policy.returnPct) ?? undefined,
        policyId: policy.type === "savings" ? policyId : undefined,
        policyAssetId: policy.type === "savings" ? policyAssetId : undefined,
      },
    ];
  });

  if (policies.length > 0) {
    events.push({
      id: buildOnboardingEventId(scenarioId, "insurance-detailed"),
      type: "insurance",
      mode: "detailed",
      policies,
      label: "Insurance",
    });
  }

  return { assets, events };
};

const buildAssetEntries = ({
  draft,
  scenarioId,
}: {
  draft: OnboardingV2Draft;
  scenarioId: string;
}): ScenarioAsset[] => {
  const assets: ScenarioAsset[] = [];

  if (normalizeAmount(draft.assets.cash.amount) > 0) {
    const cashValue = normalizeAmount(draft.assets.cash.amount);
    assets.push({
      id: buildAssetsEntityId(scenarioId, "cash"),
      kind: "cash",
      label: "Cash",
      currentValue: cashValue,
      startMonth: normalizeMonth(draft.assets.cash.startMonth) ?? undefined,
      source: "manual",
    });
  }

  const investmentStart = normalizeMonth(draft.assets.investment.startMonth);
  if (investmentStart) {
    if (draft.assets.investment.breakdownEnabled) {
      draft.assets.investment.breakdown.forEach((entry) => {
        const amount = normalizeAmount(entry.value);
        if (amount <= 0) {
          return;
        }
        assets.push({
          id: buildAssetsEntityId(scenarioId, `investment-${entry.id}`),
          kind: "investment",
          label: entry.type,
          currentValue: amount,
          startMonth: investmentStart ?? undefined,
          source: "manual",
        });
      });
    } else if (normalizeAmount(draft.assets.investment.totalAmount) > 0) {
      const totalAmount = normalizeAmount(draft.assets.investment.totalAmount);
      assets.push({
        id: buildAssetsEntityId(scenarioId, "investment-total"),
        kind: "investment",
        label: "Investments",
        currentValue: totalAmount,
        startMonth: investmentStart ?? undefined,
        source: "manual",
      });
    }
  }

  if (draft.assets.car.enabled && normalizeAmount(draft.assets.car.value) > 0) {
    const carValue = normalizeAmount(draft.assets.car.value);
    assets.push({
      id: buildAssetsEntityId(scenarioId, "car"),
      kind: "car",
      label: "Car",
      currentValue: carValue,
      startMonth: normalizeMonth(draft.assets.car.startMonth) ?? undefined,
      source: "manual",
      depreciationSource: "carDepreciation",
    });
  }

  draft.assets.insurances.forEach((entry) => {
    const cashValue = normalizeAmount(entry.cashValue);
    if (cashValue <= 0) {
      return;
    }
    assets.push({
      id: buildAssetsEntityId(scenarioId, `insurance-cash-${entry.id}`),
      kind: "policy",
      label: "Insurance cash value",
      ownerMemberId: normalizeMemberId(entry.memberId),
      currentValue: cashValue,
      startMonth: normalizeMonth(entry.startMonth) ?? undefined,
      source: "manual",
    });
  });

  return assets;
};

const buildContributionEvents = ({
  contributions,
  scenarioId,
  baseMonth,
}: {
  contributions: OnboardingV2Draft["assets"]["contributions"];
  scenarioId: string;
  baseMonth?: string;
}): CashflowEvent[] => {
  const events: CashflowEvent[] = [];

  contributions.forEach((contribution) => {
    const amount = normalizeAmount(contribution.amount);
    if (amount <= 0) {
      return;
    }
    const startMonth = normalizeMonth(contribution.startMonth) ?? baseMonth;
    if (!startMonth) {
      return;
    }
    events.push({
      id: buildOnboardingEventId(
        scenarioId,
        `investment-contribution-${contribution.id}`
      ),
      type: "cashflow",
      kind: "expense",
      cadence: "monthly",
      amount,
      label: "Investment contribution",
      startMonth,
      endMonth: resolveRecurringEndMonth({
        startMonth,
        endMonth: normalizeMonth(contribution.endMonth),
      }),
      memberId: normalizeMemberId(contribution.memberId),
    });
  });

  return events;
};

const buildMergedList = <T extends { id: string }>(
  existing: T[] | undefined,
  incoming: T[],
  scenarioId: string
) => {
  const prefix = `${ONBOARDING_V2_PREFIX}-${scenarioId}-`;
  const kept = (existing ?? []).filter((item) => !item.id.startsWith(prefix));
  return [...kept, ...incoming];
};

export const applyOnboardingV2DraftToScenarioV2 = (
  draft: OnboardingV2Draft,
  scenario: Scenario
): Scenario => {
  const scenarioId = scenario.id;
  const existingMembers = scenario.members ?? [];
  const normalizedMembers = normalizeDraftMembers(draft.household.members);
  const primaryMemberId = resolvePrimaryMemberId({
    existingMembers,
    normalizedMembers,
  });
  const applyScope = buildApplyScope(scenarioId);
  const members: ScenarioMember[] = normalizedMembers.map((member) => ({
    id: member.id === "self" ? primaryMemberId : member.id,
    name: member.name?.trim() || fallbackMemberName(member),
    kind: member.role === "pet" ? ("pet" as const) : ("person" as const),
    birthMonth: normalizeMonth(member.birthMonth),
    applyScope,
    milestones: [],
  }));

  const cashStartMonth = normalizeMonth(draft.assets.cash.startMonth);
  const startMonth = normalizeMonth(draft.profile.startMonth) ?? cashStartMonth;
  const assumptionsPatch = buildAssumptionsPatch({
    draft: draft.assumptions,
    existing: scenario.assumptions,
  });
  const cashAmount = normalizeAmount(draft.assets.cash.amount);
  const inflationRate =
    typeof assumptionsPatch.inflationRate === "number"
      ? assumptionsPatch.inflationRate
      : scenario.assumptions.inflationRate ?? 0;
  const baseCurrency = normalizeCurrency(
    draft.profile.baseCurrency ?? scenario.baseCurrency
  );
  const baseMonth = startMonth ?? normalizeMonth(scenario.assumptions.baseMonth ?? "");
  const horizonMonths = resolvePlanningHorizonMonths(draft.profile.horizonYears);
  const horizonEnd =
    baseMonth && Number.isFinite(horizonMonths)
      ? addMonths(baseMonth, Math.max(horizonMonths - 1, 0))
      : undefined;

  const incomeEvents = buildIncomeEvents({
    incomes: draft.incomes,
    scenarioId,
    baseMonth: baseMonth ?? undefined,
  });
  const livingEvents = buildLivingSpendEvents({
    livingSpend: draft.livingSpend,
    scenarioId,
    baseMonth: baseMonth ?? undefined,
    horizonEnd,
  });
  const housingChanges = buildHousingChanges({
    housing: draft.housing,
    scenarioId,
    baseMonth: baseMonth ?? undefined,
    inflationRate,
  });
  const debtChanges = buildDebtEvents({
    debts: draft.debts,
    scenarioId,
    baseMonth: baseMonth ?? undefined,
  });
  const insuranceChanges = buildInsuranceChanges({
    insurance: draft.insurance,
    scenarioId,
    baseMonth: baseMonth ?? undefined,
  });
  const assetEntries = buildAssetEntries({ draft, scenarioId });
  const contributionEvents = buildContributionEvents({
    contributions: draft.assets.contributions,
    scenarioId,
    baseMonth: baseMonth ?? undefined,
  });

  const events: ScenarioEvent[] = [
    ...incomeEvents,
    ...livingEvents,
    ...housingChanges.events,
    ...contributionEvents,
    ...debtChanges.events,
    ...insuranceChanges.events,
  ];

  const assumptions: ScenarioAssumptions = {
    ...scenario.assumptions,
    ...assumptionsPatch,
    horizonMonths,
    initialCash: cashAmount,
    baseMonth: baseMonth ?? scenario.assumptions.baseMonth ?? null,
  };

  const nextMembers = ensureSinglePrimaryMember({
    members: [
    ...existingMembers.filter((member) => !isOnboardingMemberId(member.id)),
    ...members,
    ],
    primaryMemberId,
  });
  const nextAssets = buildMergedList(
    scenario.assets,
    [...assetEntries, ...housingChanges.assets, ...insuranceChanges.assets],
    scenarioId
  );
  const nextLiabilities = buildMergedList(
    scenario.liabilities,
    [...housingChanges.liabilities, ...debtChanges.liabilities],
    scenarioId
  );
  const nextEvents = buildMergedList(scenario.events, events, scenarioId);

  return {
    ...scenario,
    baseCurrency,
    assumptions,
    members: nextMembers,
    assets: nextAssets,
    liabilities: nextLiabilities,
    events: nextEvents,
  };
};
