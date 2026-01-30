import { defaultCurrency } from "../../../../lib/i18n";
import type { AssetItemUpsert } from "../../../../features/assets/types";
import type { LiabilityItemUpsert } from "../../../../features/liabilities/types";
import type { MoneyItemUpsert } from "../../../../features/moneyFlow/types";
import { addMonths } from "../../members/age";
import type { ApplyScope } from "../../applyScope";
import type {
  CarPositionDraft,
  InsurancePositionDraft,
  InvestmentAssetClass,
  InvestmentPositionDraft,
  ScenarioMember,
  ScenarioAssumptions,
} from "../../../store/scenarioStore";
import { compareMonthKey, isValidMonthKey } from "../../../utils/monthKey";
import type { EventDefinition } from "../../events/types";
import {
  type OnboardingV2DraftAssumptions,
  buildAssumptionsPatch,
} from "./assumptions";

export type OnboardingV2MemberRole = "self" | "partner" | "child" | "pet";

export type OnboardingV2DraftMember = {
  id: string;
  role: OnboardingV2MemberRole;
  name?: string;
  birthMonth?: string;
};

export type OnboardingV2DraftProfile = {
  baseCurrency?: string;
  horizonYears?: number;
  startMonth?: string;
};

export type OnboardingV2IncomeFrequency = "monthly" | "quarterly" | "yearly" | "oneOff";

export type OnboardingV2DraftIncome = {
  id: string;
  label: string;
  amount: number;
  frequency: OnboardingV2IncomeFrequency;
  startMonth?: string;
  endMonth?: string;
  memberId?: string;
  followIncomeGrowth: boolean;
};

export type OnboardingV2LivingSpendCategoryKey =
  | "food"
  | "transport"
  | "entertainment"
  | "medical"
  | "education"
  | "misc";

export type OnboardingV2DraftAnnualExpense = {
  mode: "monthly" | "annual";
  monthlyAmount: number;
  annualAmount: number;
  months: string[];
};

export type OnboardingV2DraftLivingSpendOtherItem = {
  id: string;
  label: string;
  amount: number;
  startMonth?: string;
  endMonth?: string;
};

export type OnboardingV2DraftHousingRent = {
  amount: number;
  startMonth?: string;
  endMonth?: string;
  rentGrowthPct?: number | null;
};

export type OnboardingV2DraftHousingFee = {
  id: string;
  label: string;
  amount: number;
  month?: string;
};

export type OnboardingV2DraftHousingOngoingCost = {
  id: string;
  label: string;
  amount: number;
  startMonth?: string;
  endMonth?: string;
};

export type OnboardingV2DraftHousingRental = {
  enabled: boolean;
  amount: number;
  startMonth?: string;
  endMonth?: string;
  discountAmount?: number;
};

export type OnboardingV2DraftHousingOwn = {
  propertyValue: number;
  startMonth?: string;
  downPaymentMode: "percent" | "amount";
  downPaymentPercent?: number;
  downPaymentAmount?: number;
  mortgageEnabled: boolean;
  mortgageRatePct?: number;
  mortgageTermMonths?: number;
  mortgagePayment?: number;
  fees: OnboardingV2DraftHousingFee[];
  ongoingCosts: OnboardingV2DraftHousingOngoingCost[];
  rental: OnboardingV2DraftHousingRental;
};

export type OnboardingV2DraftHousing = {
  mode: "rent" | "own";
  rent: OnboardingV2DraftHousingRent;
  own: OnboardingV2DraftHousingOwn;
};

export type OnboardingV2DraftLivingSpend = {
  fixed: {
    amount: number;
    startMonth?: string;
    endMonth?: string;
  };
  variable: {
    amount: number;
  };
  categoryBreakdown: {
    enabled: boolean;
    categories: Record<OnboardingV2LivingSpendCategoryKey, number>;
  };
  travel: OnboardingV2DraftAnnualExpense;
  tax: OnboardingV2DraftAnnualExpense;
  otherFixed: OnboardingV2DraftLivingSpendOtherItem[];
};

export type OnboardingV2DraftInvestmentBreakdownType =
  | "stock"
  | "etf"
  | "fund"
  | "crypto"
  | "other";

export type OnboardingV2DraftInvestmentBreakdown = {
  id: string;
  type: OnboardingV2DraftInvestmentBreakdownType;
  value: number;
  followGlobalReturn: boolean;
  customReturnPct?: number | null;
};

export type OnboardingV2DraftInvestment = {
  totalAmount: number;
  startMonth?: string;
  breakdownEnabled: boolean;
  breakdown: OnboardingV2DraftInvestmentBreakdown[];
};

export type OnboardingV2DraftInvestmentContribution = {
  id: string;
  amount: number;
  startMonth?: string;
  endMonth?: string;
  memberId?: string;
};

export type OnboardingV2DraftCarAsset = {
  enabled: boolean;
  value: number;
  startMonth?: string;
  depreciationPct?: number | null;
};

export type OnboardingV2DraftInsuranceCashValue = {
  id: string;
  cashValue: number;
  startMonth?: string;
  memberId?: string;
  returnPct?: number | null;
};

export type OnboardingV2DraftAssets = {
  cash: {
    amount: number;
    startMonth?: string;
  };
  investment: OnboardingV2DraftInvestment;
  contributions: OnboardingV2DraftInvestmentContribution[];
  car: OnboardingV2DraftCarAsset;
  insurances: OnboardingV2DraftInsuranceCashValue[];
};

export type OnboardingV2Draft = {
  profile: OnboardingV2DraftProfile;
  household: {
    members: OnboardingV2DraftMember[];
  };
  assumptions: OnboardingV2DraftAssumptions;
  incomes: OnboardingV2DraftIncome[];
  livingSpend: OnboardingV2DraftLivingSpend;
  housing: OnboardingV2DraftHousing;
  assets: OnboardingV2DraftAssets;
};

export type OnboardingV2IncomeMoneyItem = {
  item: MoneyItemUpsert;
  annualGrowthPct: number;
};

export type OnboardingV2ScenarioChanges = {
  membersToUpsert: ScenarioMember[];
  memberIdsToDelete: string[];
  settingsPatch: {
    baseCurrency?: string;
    horizonMonths?: number;
    startMonth?: string;
  };
  assumptionsPatch: Partial<ScenarioAssumptions>;
  incomeMoneyItems: OnboardingV2IncomeMoneyItem[];
  expenseMoneyItems: MoneyItemUpsert[];
  housingAssets: AssetItemUpsert[];
  housingLiabilities: LiabilityItemUpsert[];
  housingEventDefinitions: EventDefinition[];
  assetEventDefinitions: EventDefinition[];
  investmentPositions: InvestmentPositionDraft[];
  insurancePositions: InsurancePositionDraft[];
  carPositions: CarPositionDraft[];
};

const ONBOARDING_MEMBER_ID = /^(self|partner|child-\d+|pet-\d+)$/;
export const ONBOARDING_V2_INCOME_GENERATED_EVENT_ID = "onboarding-v2-income";
export const ONBOARDING_V2_LIVING_SPEND_GENERATED_EVENT_ID =
  "onboarding-v2-living-spend";
export const ONBOARDING_V2_HOUSING_GENERATED_EVENT_ID = "onboarding-v2-housing";
export const ONBOARDING_V2_ASSETS_GENERATED_EVENT_ID = "onboarding-v2-assets";

const isOnboardingMemberId = (id: string) => ONBOARDING_MEMBER_ID.test(id);

const resolveHorizonMonths = (years?: number) => {
  if (years === 3) {
    return 36;
  }
  if (years === 10) {
    return 120;
  }
  return 60;
};

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

const resolveRangeEndMonth = ({
  startMonth,
  endMonth,
  horizonEnd,
}: {
  startMonth: string;
  endMonth?: string;
  horizonEnd?: string;
}) => {
  if (endMonth && isValidMonthKey(endMonth)) {
    if (compareMonthKey(endMonth, startMonth) < 0) {
      return startMonth;
    }
    return endMonth;
  }
  return horizonEnd ?? startMonth;
};

const buildRecurringMonths = ({
  startMonth,
  endMonth,
  stepMonths,
}: {
  startMonth: string;
  endMonth: string;
  stepMonths: number;
}) => {
  const months: string[] = [];
  let current = startMonth;

  while (compareMonthKey(current, endMonth) <= 0) {
    months.push(current);
    current = addMonths(current, stepMonths);
  }

  return months;
};

const buildIncomeMoneyItems = ({
  incomes,
  baseCurrency,
  baseMonth,
  horizonEnd,
  incomeGrowthPct,
}: {
  incomes: OnboardingV2DraftIncome[];
  baseCurrency: string;
  baseMonth?: string;
  horizonEnd?: string;
  incomeGrowthPct: number;
}): OnboardingV2IncomeMoneyItem[] => {
  const items: OnboardingV2IncomeMoneyItem[] = [];

  incomes.forEach((income) => {
    const label = income.label?.trim();
    if (!label) {
      return;
    }
    if (!Number.isFinite(income.amount) || income.amount <= 0) {
      return;
    }

    const resolvedStart = normalizeMonth(income.startMonth) ?? baseMonth;
    const resolvedEnd = normalizeMonth(income.endMonth);
    const memberId = normalizeMemberId(income.memberId);

    if (!resolvedStart) {
      return;
    }

    if (income.frequency === "monthly") {
      items.push({
        item: {
          kind: "income",
          cadence: "recurring",
          amount: income.amount,
          currency: baseCurrency,
          category: "salary",
          memberId,
          startMonth: resolvedStart,
          endMonth: resolvedEnd,
          notes: label,
          source: "eventGenerated",
          generatedByEventId: ONBOARDING_V2_INCOME_GENERATED_EVENT_ID,
        },
        annualGrowthPct: income.followIncomeGrowth ? incomeGrowthPct : 0,
      });
      return;
    }

    if (income.frequency === "oneOff") {
      items.push({
        item: {
          kind: "income",
          cadence: "oneOff",
          amount: income.amount,
          currency: baseCurrency,
          category: "salary",
          memberId,
          month: resolvedStart,
          notes: label,
          source: "eventGenerated",
          generatedByEventId: ONBOARDING_V2_INCOME_GENERATED_EVENT_ID,
        },
        annualGrowthPct: 0,
      });
      return;
    }

    const endMonth = resolveRangeEndMonth({
      startMonth: resolvedStart,
      endMonth: resolvedEnd,
      horizonEnd,
    });
    const stepMonths = income.frequency === "quarterly" ? 3 : 12;
    const months = buildRecurringMonths({
      startMonth: resolvedStart,
      endMonth,
      stepMonths,
    });

    months.forEach((month) => {
      items.push({
        item: {
          kind: "income",
          cadence: "oneOff",
          amount: income.amount,
          currency: baseCurrency,
          category: "salary",
          memberId,
          month,
          notes: label,
          source: "eventGenerated",
          generatedByEventId: ONBOARDING_V2_INCOME_GENERATED_EVENT_ID,
        },
        annualGrowthPct: 0,
      });
    });
  });

  return items;
};

const buildAnnualExpenseMonths = ({
  baseMonth,
  horizonEnd,
  startMonths,
}: {
  baseMonth?: string;
  horizonEnd?: string;
  startMonths: string[];
}) => {
  if (!baseMonth || !horizonEnd) {
    return [];
  }
  const normalizedStartMonths = Array.from(new Set(startMonths));
  const months = new Set<string>();

  normalizedStartMonths.forEach((startMonth) => {
    let current = startMonth;
    while (compareMonthKey(current, baseMonth) < 0) {
      current = addMonths(current, 12);
    }
    while (compareMonthKey(current, horizonEnd) <= 0) {
      months.add(current);
      current = addMonths(current, 12);
    }
  });

  return Array.from(months).sort(compareMonthKey);
};

const buildLivingSpendMoneyItems = ({
  livingSpend,
  baseCurrency,
  baseMonth,
  horizonEnd,
}: {
  livingSpend: OnboardingV2DraftLivingSpend;
  baseCurrency: string;
  baseMonth?: string;
  horizonEnd?: string;
}): MoneyItemUpsert[] => {
  const items: MoneyItemUpsert[] = [];
  const fixedStart =
    normalizeMonth(livingSpend.fixed.startMonth) ?? baseMonth ?? "";
  if (!fixedStart) {
    return items;
  }
  const fixedEnd = resolveRecurringEndMonth({
    startMonth: fixedStart,
    endMonth: normalizeMonth(livingSpend.fixed.endMonth),
  });

  const addRecurringExpense = ({
    amount,
    category,
    notes,
    startMonth,
    endMonth,
  }: {
    amount: number;
    category: string;
    notes?: string;
    startMonth: string;
    endMonth?: string;
  }) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    items.push({
      kind: "expense",
      cadence: "recurring",
      amount,
      currency: baseCurrency,
      category,
      startMonth,
      endMonth,
      notes,
      source: "eventGenerated",
      sourceType: "event",
      generatedByEventId: ONBOARDING_V2_LIVING_SPEND_GENERATED_EVENT_ID,
    });
  };

  const addOneOffExpense = ({
    amount,
    category,
    notes,
    month,
  }: {
    amount: number;
    category: string;
    notes?: string;
    month: string;
  }) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    items.push({
      kind: "expense",
      cadence: "oneOff",
      amount,
      currency: baseCurrency,
      category,
      month,
      notes,
      source: "eventGenerated",
      sourceType: "event",
      generatedByEventId: ONBOARDING_V2_LIVING_SPEND_GENERATED_EVENT_ID,
    });
  };

  if (!livingSpend.categoryBreakdown.enabled) {
    addRecurringExpense({
      amount: normalizeAmount(livingSpend.fixed.amount),
      category: "custom",
      notes: "Living expenses",
      startMonth: fixedStart,
      endMonth: fixedEnd,
    });
  }

  addRecurringExpense({
    amount: normalizeAmount(livingSpend.variable.amount),
    category: "custom",
    notes: "Variable spending",
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
        addRecurringExpense({
          amount: normalizeAmount(livingSpend.categoryBreakdown.categories[key]),
          category: "custom",
          notes: categoryLabels[key],
          startMonth: fixedStart,
          endMonth: fixedEnd,
        });
      }
    );
  }

  const resolvedAnnualExpenses = [
    {
      draft: livingSpend.travel,
      category: "travel",
      label: "Travel",
    },
    {
      draft: livingSpend.tax,
      category: "custom",
      label: "Tax",
    },
  ];

  resolvedAnnualExpenses.forEach(({ draft, category, label }) => {
    if (draft.mode === "monthly") {
      addRecurringExpense({
        amount: normalizeAmount(draft.monthlyAmount),
        category,
        notes: label,
        startMonth: fixedStart,
        endMonth: fixedEnd,
      });
      return;
    }

    const annualAmount = normalizeAmount(draft.annualAmount);
    const startMonths = Array.from(
      new Set(draft.months.filter((month) => isValidMonthKey(month)))
    );
    const months = buildAnnualExpenseMonths({
      baseMonth: fixedStart,
      horizonEnd,
      startMonths,
    });
    if (annualAmount <= 0 || startMonths.length === 0 || months.length === 0) {
      return;
    }
    const perMonthAmount = annualAmount / startMonths.length;
    months.forEach((month) => {
      addOneOffExpense({
        amount: perMonthAmount,
        category,
        notes: label,
        month,
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
    addRecurringExpense({
      amount,
      category: "custom",
      notes: label,
      startMonth,
      endMonth,
    });
  });

  return items;
};

const buildHousingEntityId = (scenarioId: string, key: string) =>
  `onboarding-v2-${scenarioId}-housing-${key}`;

const buildHousingChanges = ({
  housing,
  scenarioId,
  baseCurrency,
  baseMonth,
  inflationRate,
}: {
  housing: OnboardingV2DraftHousing;
  scenarioId: string;
  baseCurrency: string;
  baseMonth?: string;
  inflationRate: number;
}) => {
  const assets: AssetItemUpsert[] = [];
  const liabilities: LiabilityItemUpsert[] = [];
  const eventDefinitions: EventDefinition[] = [];

  const propertyId = buildHousingEntityId(scenarioId, "property");
  const mortgageId = buildHousingEntityId(scenarioId, "mortgage");
  const resolvedBaseMonth = baseMonth ?? "";

  if (housing.mode === "rent") {
    const amount = normalizeAmount(housing.rent.amount);
    const startMonth = normalizeMonth(housing.rent.startMonth) ?? resolvedBaseMonth;
    const endMonth = resolveRecurringEndMonth({
      startMonth,
      endMonth: normalizeMonth(housing.rent.endMonth),
    });
    if (amount > 0 && startMonth) {
      const rentGrowthPct = normalizeOptionalNumber(housing.rent.rentGrowthPct);
      eventDefinitions.push({
        id: buildHousingEntityId(scenarioId, "rent-expense"),
        title: "Rent",
        type: "rent",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth,
          endMonth: endMonth ?? null,
          monthlyAmount: amount,
          oneTimeAmount: 0,
          annualGrowthPct: rentGrowthPct ?? inflationRate,
        },
        currency: baseCurrency,
        generatedByEventId: ONBOARDING_V2_HOUSING_GENERATED_EVENT_ID,
        source: "eventGenerated",
      });
    }
    return { assets, liabilities, eventDefinitions };
  }

  const propertyValue = normalizeAmount(housing.own.propertyValue);
  const propertyStartMonth =
    normalizeMonth(housing.own.startMonth) ?? resolvedBaseMonth;
  if (propertyValue > 0 && propertyStartMonth) {
    assets.push({
      id: propertyId,
      assetType: "property",
      name: "Property",
      currentValue: propertyValue,
      currency: baseCurrency,
      startMonth: propertyStartMonth,
      source: "eventGenerated",
      generatedByEventId: ONBOARDING_V2_HOUSING_GENERATED_EVENT_ID,
    });
  }

  const downPaymentPercent =
    housing.own.downPaymentMode === "percent"
      ? normalizeAmount(housing.own.downPaymentPercent)
      : propertyValue > 0
        ? (normalizeAmount(housing.own.downPaymentAmount) / propertyValue) * 100
        : 0;
  const downPaymentAmount =
    housing.own.downPaymentMode === "percent"
      ? (propertyValue * downPaymentPercent) / 100
      : normalizeAmount(housing.own.downPaymentAmount);
  const loanAmount = Math.max(0, propertyValue - downPaymentAmount);

  const mortgageRatePct = normalizeAmount(housing.own.mortgageRatePct);
  const mortgageTermMonths = Math.max(
    1,
    Math.round(normalizeAmount(housing.own.mortgageTermMonths))
  );

  if (
    housing.own.mortgageEnabled &&
    loanAmount > 0 &&
    propertyStartMonth
  ) {
    liabilities.push({
      id: mortgageId,
      liabilityType: "mortgage",
      name: "Mortgage",
      principalOutstanding: loanAmount,
      currency: baseCurrency,
      interestRate: mortgageRatePct,
      termMonths: mortgageTermMonths,
      startMonth: propertyStartMonth,
      purchasePrice: propertyValue,
      downPaymentPercent,
      generatePaymentExpense: false,
      linkedAssetId: propertyId,
      source: "eventGenerated",
      generatedByEventId: ONBOARDING_V2_HOUSING_GENERATED_EVENT_ID,
    });
  }

  if (
    housing.own.mortgageEnabled &&
    normalizeAmount(housing.own.mortgagePayment) > 0 &&
    propertyStartMonth
  ) {
    const paymentEndMonth = mortgageTermMonths
      ? addMonths(propertyStartMonth, Math.max(mortgageTermMonths - 1, 0))
      : undefined;
    eventDefinitions.push({
      id: buildHousingEntityId(scenarioId, "mortgage-payment"),
      title: "Mortgage payment",
      type: "custom",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth: propertyStartMonth,
        endMonth: paymentEndMonth ?? null,
        monthlyAmount: normalizeAmount(housing.own.mortgagePayment),
        oneTimeAmount: 0,
        annualGrowthPct: 0,
      },
      currency: baseCurrency,
      generatedByEventId: ONBOARDING_V2_HOUSING_GENERATED_EVENT_ID,
      source: "eventGenerated",
      linkedLiabilityId: mortgageId,
    });
  }

  housing.own.fees.forEach((fee) => {
    const label = fee.label?.trim();
    if (!label) {
      return;
    }
    const amount = normalizeAmount(fee.amount);
    if (amount <= 0) {
      return;
    }
    const month =
      normalizeMonth(fee.month) ?? propertyStartMonth ?? resolvedBaseMonth;
    if (!month) {
      return;
    }
    eventDefinitions.push({
      id: buildHousingEntityId(scenarioId, `fee-${fee.id}`),
      title: label,
      type: "custom",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth: month,
        endMonth: null,
        monthlyAmount: 0,
        oneTimeAmount: amount,
        annualGrowthPct: 0,
      },
      currency: baseCurrency,
      generatedByEventId: ONBOARDING_V2_HOUSING_GENERATED_EVENT_ID,
      source: "eventGenerated",
      linkedAssetId: propertyId,
    });
  });

  housing.own.ongoingCosts.forEach((cost) => {
    const label = cost.label?.trim();
    if (!label) {
      return;
    }
    const amount = normalizeAmount(cost.amount);
    if (amount <= 0) {
      return;
    }
    const startMonth =
      normalizeMonth(cost.startMonth) ?? propertyStartMonth ?? resolvedBaseMonth;
    if (!startMonth) {
      return;
    }
    const endMonth = resolveRecurringEndMonth({
      startMonth,
      endMonth: normalizeMonth(cost.endMonth),
    });
    eventDefinitions.push({
      id: buildHousingEntityId(scenarioId, `cost-${cost.id}`),
      title: label,
      type: "custom",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth,
        endMonth: endMonth ?? null,
        monthlyAmount: amount,
        oneTimeAmount: 0,
        annualGrowthPct: 0,
      },
      currency: baseCurrency,
      generatedByEventId: ONBOARDING_V2_HOUSING_GENERATED_EVENT_ID,
      source: "eventGenerated",
      linkedAssetId: propertyId,
    });
  });

  if (housing.own.rental.enabled) {
    const rentAmount = normalizeAmount(housing.own.rental.amount);
    const discountAmount = normalizeAmount(housing.own.rental.discountAmount);
    const netAmount = Math.max(0, rentAmount - discountAmount);
    const startMonth =
      normalizeMonth(housing.own.rental.startMonth) ??
      propertyStartMonth ??
      resolvedBaseMonth;
    const endMonth = resolveRecurringEndMonth({
      startMonth,
      endMonth: normalizeMonth(housing.own.rental.endMonth),
    });
    if (netAmount > 0 && startMonth) {
      eventDefinitions.push({
        id: buildHousingEntityId(scenarioId, "rental-income"),
        title: "Rental income",
        type: "salary",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth,
          endMonth: endMonth ?? null,
          monthlyAmount: netAmount,
          oneTimeAmount: 0,
          annualGrowthPct: inflationRate,
        },
        currency: baseCurrency,
        incomeSubtype: "rental",
        generatedByEventId: ONBOARDING_V2_HOUSING_GENERATED_EVENT_ID,
        source: "eventGenerated",
        linkedAssetId: propertyId,
      });
    }
  }

  return { assets, liabilities, eventDefinitions };
};

const buildAssetsEntityId = (scenarioId: string, key: string) =>
  `onboarding-v2-${scenarioId}-assets-${key}`;

const investmentClassMap: Record<
  OnboardingV2DraftInvestmentBreakdownType,
  InvestmentAssetClass | undefined
> = {
  stock: "equity",
  etf: "equity",
  fund: "fund",
  crypto: "crypto",
  other: undefined,
};

const investmentLabelMap: Record<
  OnboardingV2DraftInvestmentBreakdownType,
  string
> = {
  stock: "Stocks",
  etf: "ETF",
  fund: "Fund",
  crypto: "Crypto",
  other: "Other",
};

const buildAssetsChanges = ({
  assets,
  scenarioId,
  baseCurrency,
  baseMonth,
  defaultCarDepreciationPct,
}: {
  assets: OnboardingV2DraftAssets;
  scenarioId: string;
  baseCurrency: string;
  baseMonth?: string;
  defaultCarDepreciationPct: number;
}) => {
  const investments: InvestmentPositionDraft[] = [];
  const insurances: InsurancePositionDraft[] = [];
  const cars: CarPositionDraft[] = [];
  const eventDefinitions: EventDefinition[] = [];

  const resolvedInvestmentStart =
    normalizeMonth(assets.investment.startMonth) ?? baseMonth;
  const investmentBreakdown = assets.investment.breakdownEnabled
    ? assets.investment.breakdown
    : [];
  const validBreakdown = investmentBreakdown.filter(
    (entry) => normalizeAmount(entry.value) > 0
  );

  if (resolvedInvestmentStart) {
    if (validBreakdown.length > 0) {
      validBreakdown.forEach((entry) => {
        const amount = normalizeAmount(entry.value);
        if (amount <= 0) {
          return;
        }
        const assetClass = investmentClassMap[entry.type];
        investments.push({
          id: buildAssetsEntityId(scenarioId, `investment-${entry.id}`),
          name: investmentLabelMap[entry.type],
          assetClass,
          startMonth: resolvedInvestmentStart,
          initialValue: amount,
          expectedAnnualReturnPct: entry.followGlobalReturn
            ? undefined
            : normalizeOptionalNumber(entry.customReturnPct) ?? undefined,
          monthlyContribution: 0,
          monthlyWithdrawal: 0,
          feeAnnualRatePct: 0,
          source: "eventGenerated",
          generatedByEventId: ONBOARDING_V2_ASSETS_GENERATED_EVENT_ID,
        });
      });
    } else {
      const totalAmount = normalizeAmount(assets.investment.totalAmount);
      if (totalAmount > 0) {
        investments.push({
          id: buildAssetsEntityId(scenarioId, "investment-total"),
          name: "Investments",
          startMonth: resolvedInvestmentStart,
          initialValue: totalAmount,
          source: "eventGenerated",
          generatedByEventId: ONBOARDING_V2_ASSETS_GENERATED_EVENT_ID,
        });
      }
    }
  }

  assets.contributions.forEach((contribution) => {
    const amount = normalizeAmount(contribution.amount);
    if (amount <= 0) {
      return;
    }
    const startMonth =
      normalizeMonth(contribution.startMonth) ?? baseMonth ?? "";
    if (!startMonth) {
      return;
    }
    const endMonth = resolveRecurringEndMonth({
      startMonth,
      endMonth: normalizeMonth(contribution.endMonth),
    });
    eventDefinitions.push({
      id: buildAssetsEntityId(scenarioId, `investment-contribution-${contribution.id}`),
      title: "Investment contribution",
      type: "investment_contribution",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth,
        endMonth: endMonth ?? null,
        monthlyAmount: amount,
        oneTimeAmount: 0,
        annualGrowthPct: 0,
      },
      currency: baseCurrency,
      memberId: normalizeMemberId(contribution.memberId),
      generatedByEventId: ONBOARDING_V2_ASSETS_GENERATED_EVENT_ID,
      source: "eventGenerated",
    });
  });

  if (assets.car.enabled) {
    const carValue = normalizeAmount(assets.car.value);
    const carStartMonth =
      normalizeMonth(assets.car.startMonth) ?? baseMonth ?? "";
    if (carValue > 0 && carStartMonth) {
      const depreciationPct =
        normalizeOptionalNumber(assets.car.depreciationPct) ??
        defaultCarDepreciationPct;
      cars.push({
        id: buildAssetsEntityId(scenarioId, "car"),
        name: "Car",
        purchaseMonth: carStartMonth,
        purchasePrice: carValue,
        downPayment: 0,
        annualDepreciationRatePct: depreciationPct,
        holdingCostMonthly: 0,
        holdingCostAnnualGrowthPct: 0,
        source: "eventGenerated",
        generatedByEventId: ONBOARDING_V2_ASSETS_GENERATED_EVENT_ID,
      });
    }
  }

  assets.insurances.forEach((insurance) => {
    const cashValue = normalizeAmount(insurance.cashValue);
    if (cashValue <= 0) {
      return;
    }
    const startMonth =
      normalizeMonth(insurance.startMonth) ?? baseMonth ?? "";
    if (!startMonth) {
      return;
    }
    insurances.push({
      id: buildAssetsEntityId(scenarioId, `insurance-${insurance.id}`),
      name: "Insurance policy",
      ownerMemberId: normalizeMemberId(insurance.memberId),
      enabled: true,
      kind: "savings",
      startMonth,
      premiumMonthly: 0,
      premiumAnnualGrowthPct: 0,
      initialCashValue: cashValue,
      expectedAnnualReturnPct: normalizeOptionalNumber(insurance.returnPct) ?? undefined,
      source: "eventGenerated",
      generatedByEventId: ONBOARDING_V2_ASSETS_GENERATED_EVENT_ID,
    });
  });

  return { investments, insurances, cars, eventDefinitions };
};

const buildApplyScope = (scenarioId: string): ApplyScope => ({
  scope: "include",
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

export const mapOnboardingV2DraftToScenario = ({
  draft,
  scenarioId,
  existingMembers,
  existingAssumptions,
}: {
  draft: OnboardingV2Draft;
  scenarioId: string;
  existingMembers: ScenarioMember[];
  existingAssumptions?: ScenarioAssumptions;
}): OnboardingV2ScenarioChanges => {
  const applyScope = buildApplyScope(scenarioId);
  const normalizedMembers = normalizeDraftMembers(draft.household.members);
  const desiredMemberIds = new Set(
    normalizedMembers.map((member) => member.id)
  );

  const membersToUpsert = normalizedMembers.map((member) => ({
    id: member.id,
    name: member.name?.trim() || fallbackMemberName(member),
    kind: member.role === "pet" ? ("pet" as const) : ("person" as const),
    birthMonth: normalizeMonth(member.birthMonth),
    applyScope,
    milestones: [],
  }));

  const memberIdsToDelete = existingMembers
    .map((member) => member.id)
    .filter(
      (id) => isOnboardingMemberId(id) && !desiredMemberIds.has(id)
    );

  const cashStartMonth = normalizeMonth(draft.assets.cash.startMonth);
  const startMonth = normalizeMonth(draft.profile.startMonth) ?? cashStartMonth;
  const assumptionsPatch = buildAssumptionsPatch({
    draft: draft.assumptions,
    existing: existingAssumptions,
  });
  const cashAmount = normalizeAmount(draft.assets.cash.amount);
  assumptionsPatch.initialCash = cashAmount;
  const inflationRate =
    typeof assumptionsPatch.inflationRate === "number"
      ? assumptionsPatch.inflationRate
      : existingAssumptions?.inflationRate ?? 0;
  const incomeGrowthPct =
    typeof assumptionsPatch.salaryGrowthRate === "number"
      ? assumptionsPatch.salaryGrowthRate
      : existingAssumptions?.salaryGrowthRate ?? 0;
  const baseCurrency = normalizeCurrency(draft.profile.baseCurrency);
  const baseMonth = startMonth ?? normalizeMonth(existingAssumptions?.baseMonth ?? "");
  const horizonMonths = resolveHorizonMonths(draft.profile.horizonYears);
  const horizonEnd =
    baseMonth && Number.isFinite(horizonMonths)
      ? addMonths(baseMonth, Math.max(horizonMonths - 1, 0))
      : undefined;
  const incomeMoneyItems = buildIncomeMoneyItems({
    incomes: draft.incomes,
    baseCurrency,
    baseMonth,
    horizonEnd,
    incomeGrowthPct,
  });
  const expenseMoneyItems = buildLivingSpendMoneyItems({
    livingSpend: draft.livingSpend,
    baseCurrency,
    baseMonth,
    horizonEnd,
  });
  const housingChanges = buildHousingChanges({
    housing: draft.housing,
    scenarioId,
    baseCurrency,
    baseMonth,
    inflationRate,
  });
  const defaultCarDepreciationPct =
    normalizeOptionalNumber(draft.assets.car.depreciationPct) ??
    (typeof assumptionsPatch.carDepreciationRatePct === "number"
      ? assumptionsPatch.carDepreciationRatePct
      : existingAssumptions?.carDepreciationRatePct ?? 0);
  const assetsChanges = buildAssetsChanges({
    assets: draft.assets,
    scenarioId,
    baseCurrency,
    baseMonth,
    defaultCarDepreciationPct,
  });

  return {
    membersToUpsert,
    memberIdsToDelete,
    settingsPatch: {
      baseCurrency,
      horizonMonths,
      startMonth,
    },
    assumptionsPatch,
    incomeMoneyItems,
    expenseMoneyItems,
    housingAssets: housingChanges.assets,
    housingLiabilities: housingChanges.liabilities,
    housingEventDefinitions: housingChanges.eventDefinitions,
    assetEventDefinitions: assetsChanges.eventDefinitions,
    investmentPositions: assetsChanges.investments,
    insurancePositions: assetsChanges.insurances,
    carPositions: assetsChanges.cars,
  };
};
