// Shape note: HomePosition template originally set purchase/mortgage/appreciation (+feesOneTime).
// Added defaults for holdingCostMonthly and holdingCostAnnualGrowthPct.
// Back-compat: new fields default to 0 for older scenarios.
import { nanoid } from "nanoid";
import {
  eventGroups,
  getEventGroup,
  listEventTypesByGroup,
  type EventGroup,
  type EventType,
} from "@north-star/engine";
import {
  defaultCurrency,
  formatCurrency as formatCurrencyWithLocale,
} from "../../lib/i18n";
import { normalizeMonth } from "../../src/features/timeline/schema";
import {
  buildTemplateParams,
  getInsuranceTemplate,
} from "../../src/insurance/templates";
import {
  createHomePositionId,
  createCarPositionId,
  createInvestmentPositionId,
  createLoanPositionId,
  createInsurancePositionId,
  type CarPosition,
  type CarPositionDraft,
  type HomePosition,
  type HomePositionDraft,
  type InsurancePosition,
  type InsurancePositionDraft,
  type InvestmentPosition,
  type InvestmentPositionDraft,
  type LoanPosition,
  type LoanPositionDraft,
} from "../../src/store/scenarioStore";
import { DEFAULT_ANNUAL_GROWTH_PCT } from "../../src/domain/constants";
import type {
  EventDefinition,
  ScenarioEventRef,
  ScenarioEventView,
} from "./types";

type Translator = (key: string, values?: Record<string, string | number>) => string;

export const iconMap: Record<EventType, string> = {
  rent: "🏠",
  salary: "💼",
  buy_home: "🏡",
  baby: "🍼",
  car: "🚗",
  travel: "✈️",
  insurance: "🛡️",
  insurance_product: "📄",
  insurance_premium: "🧾",
  insurance_payout: "💰",
  tax_benefit: "🏷️",
  helper: "🤝",
  investment_contribution: "📈",
  investment_withdrawal: "📉",
  custom: "✨",
};

const eventTypeLabelKeys: Record<EventType, string> = {
  rent: "eventTypes.rent",
  salary: "eventTypes.salary",
  buy_home: "eventTypes.buyHome",
  baby: "eventTypes.baby",
  car: "eventTypes.car",
  travel: "eventTypes.travel",
  insurance: "eventTypes.insurance",
  insurance_product: "eventTypes.insuranceProduct",
  insurance_premium: "eventTypes.insurancePremium",
  insurance_payout: "eventTypes.insurancePayout",
  tax_benefit: "eventTypes.taxBenefit",
  helper: "eventTypes.helper",
  investment_contribution: "eventTypes.investmentContribution",
  investment_withdrawal: "eventTypes.investmentWithdrawal",
  custom: "eventTypes.custom",
};

const groupLabelKeys: Record<EventGroup, string> = {
  income: "groups.income",
  expense: "groups.expense",
  housing: "groups.housing",
  investment: "groups.investment",
  insurance: "groups.insurance",
  debt: "groups.debt",
};

const impactHintKeys: Record<EventGroup, string> = {
  income: "impactHints.income",
  expense: "impactHints.expense",
  housing: "impactHints.housing",
  investment: "impactHints.investment",
  insurance: "impactHints.insurance",
  debt: "impactHints.debt",
};

export const getEventLabel = (t: Translator, type: EventType) =>
  t(eventTypeLabelKeys[type]);

export const getIncomeSubtypeLabel = (
  t: Translator,
  subtype: "salary" | "bonus" | "freelance" | "rental" | "dividend" | "interest" | "other"
) => t(`incomeSubtypes.${subtype}`);

export const getEventTypeDisplay = (
  t: Translator,
  type: EventType,
  incomeSubtype?: "salary" | "bonus" | "freelance" | "rental" | "dividend" | "interest" | "other"
) => {
  const baseLabel = getEventLabel(t, type);
  if (!incomeSubtype || getEventGroup(type) !== "income") {
    return baseLabel;
  }
  return `${baseLabel} · ${getIncomeSubtypeLabel(t, incomeSubtype)}`;
};

export const getEventFilterOptions = (t: Translator) => [
  { label: t("filters.all"), value: "all" },
  ...eventGroups.map((group) => ({
    label: t(groupLabelKeys[group]),
    value: group,
  })),
];

export const listEventTypesForGroup = (group: EventGroup) =>
  listEventTypesByGroup(group);

export const getEventGroupLabel = (t: Translator, type: EventType) =>
  t(groupLabelKeys[getEventGroup(type)]);

export const getEventImpactHint = (t: Translator, type: EventType) =>
  t(impactHintKeys[getEventGroup(type)]);

export const formatCurrency = (amount: number, currency: string, locale: string) =>
  formatCurrencyWithLocale(amount, currency, locale);

export const formatDateRange = (
  t: Translator,
  start: string,
  end: string | null
) => {
  if (!end) {
    return `${start} → ${t("ongoing")}`;
  }

  return `${start} → ${end}`;
};

export const createEventId = () => `evt_${nanoid(8)}`;

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

const getDefaultStartMonth = (baseMonth?: string | null) =>
  normalizeMonth(baseMonth ?? "") ?? getCurrentMonth();

const templateDefaults: Record<
  EventType,
  { monthlyAmount: number; oneTimeAmount: number; annualGrowthPct: number }
> = {
  rent: { monthlyAmount: 1800, oneTimeAmount: 0, annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT },
  salary: { monthlyAmount: 6000, oneTimeAmount: 0, annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT },
  buy_home: {
    monthlyAmount: 0,
    oneTimeAmount: 800000,
    annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
  },
  baby: { monthlyAmount: 900, oneTimeAmount: 5000, annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT },
  car: { monthlyAmount: 600, oneTimeAmount: 20000, annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT },
  travel: { monthlyAmount: 0, oneTimeAmount: 4000, annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT },
  insurance: { monthlyAmount: 250, oneTimeAmount: 0, annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT },
  insurance_product: {
    monthlyAmount: 300,
    oneTimeAmount: 0,
    annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
  },
  insurance_premium: {
    monthlyAmount: 300,
    oneTimeAmount: 0,
    annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
  },
  insurance_payout: {
    monthlyAmount: 0,
    oneTimeAmount: 15000,
    annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
  },
  tax_benefit: {
    monthlyAmount: 0,
    oneTimeAmount: 6000,
    annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
  },
  helper: { monthlyAmount: 600, oneTimeAmount: 0, annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT },
  investment_contribution: {
    monthlyAmount: 500,
    oneTimeAmount: 0,
    annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
  },
  investment_withdrawal: {
    monthlyAmount: 0,
    oneTimeAmount: 5000,
    annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
  },
  custom: { monthlyAmount: 0, oneTimeAmount: 0, annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT },
};

type CreateEventOptions = {
  baseCurrency?: string;
  baseMonth?: string | null;
  memberId?: string;
};

export const createEventDefinitionFromTemplate = (
  type: EventType,
  t: Translator,
  options: CreateEventOptions = {}
): EventDefinition => {
  const label = getEventLabel(t, type);
  const defaults = templateDefaults[type];
  const startMonth = getDefaultStartMonth(options.baseMonth);
  const insuranceTemplate =
    type === "insurance_product" ? getInsuranceTemplate() : null;
  const templateParams = insuranceTemplate
    ? buildTemplateParams(insuranceTemplate)
    : undefined;

  return {
    id: createEventId(),
    title: t("timelineEventPlan", { label }),
    type,
    kind: "cashflow",
    rule: {
      mode: "params",
      startMonth,
      endMonth: null,
      monthlyAmount: defaults.monthlyAmount,
      oneTimeAmount: defaults.oneTimeAmount,
      annualGrowthPct: defaults.annualGrowthPct,
    },
    currency: options.baseCurrency ?? defaultCurrency,
    memberId: options.memberId,
    incomeSubtype: type === "salary" ? "salary" : undefined,
    templateId: insuranceTemplate?.id,
    templateParams,
  };
};

export const createGroupDefinition = (
  title: string,
  options: { parentId?: string }
): EventDefinition => ({
  id: createEventId(),
  title,
  type: "custom",
  kind: "group",
  parentId: options.parentId,
  rule: {
    mode: "params",
  },
});

export const createScenarioEventRef = (definitionId: string): ScenarioEventRef => ({
  refId: definitionId,
  enabled: true,
  highlighted: false,
});

export const createDefinitionCopy = (definition: EventDefinition, title: string) => ({
  ...definition,
  id: createEventId(),
  title,
});

export const createHomePositionFromTemplate = (
  options?: { baseMonth?: string | null; purchaseMonth?: string | null }
): HomePositionDraft => {
  return {
    id: createHomePositionId(),
    usage: "primary",
    mode: "new_purchase",
    purchaseMonth:
      normalizeMonth(options?.purchaseMonth ?? "") ?? options?.baseMonth ?? "",
    purchasePrice: 8_000_000,
    downPayment: 2_400_000,
    annualAppreciationPct: DEFAULT_ANNUAL_GROWTH_PCT,
    mortgageRatePct: 0,
    mortgageTermYears: 30,
    feesOneTime: 0,
    holdingCostMonthly: 0,
    holdingCostAnnualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
    purchaseFees: [],
    ongoingCosts: [],
  };
};

export const createCarPositionFromTemplate = (
  options?: { baseMonth?: string | null; purchaseMonth?: string | null }
): CarPositionDraft => {
  return {
    id: createCarPositionId(),
    purchaseMonth:
      normalizeMonth(options?.purchaseMonth ?? "") ?? options?.baseMonth ?? "",
    purchasePrice: 0,
    downPayment: 0,
    annualDepreciationRatePct: 0,
    holdingCostMonthly: 0,
    holdingCostAnnualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
    purchaseFees: [],
    ongoingCosts: [],
  };
};

export const createInvestmentPositionFromTemplate = (
  options?: { baseMonth?: string | null; startMonth?: string | null }
): InvestmentPositionDraft => {
  const startMonth = getDefaultStartMonth(
    normalizeMonth(options?.startMonth ?? "") ?? options?.baseMonth ?? null
  );

  return {
    id: createInvestmentPositionId(),
    startMonth,
    initialValue: 200_000,
    assetClass: "fund",
    expectedAnnualReturnPct: DEFAULT_ANNUAL_GROWTH_PCT,
    monthlyContribution: 5000,
    monthlyWithdrawal: 0,
    feeAnnualRatePct: 0.6,
  };
};

export const createLoanPositionFromTemplate = (
  options?: { baseMonth?: string | null; startMonth?: string | null }
): LoanPositionDraft => {
  const startMonth = getDefaultStartMonth(
    normalizeMonth(options?.startMonth ?? "") ?? options?.baseMonth ?? null
  );

  return {
    id: createLoanPositionId(),
    startMonth,
    loanType: "loan",
    principal: 500_000,
    annualInterestRatePct: 4,
    termYears: 5,
    paymentMethod: "amortization",
    monthlyPayment: undefined,
    feesOneTime: 0,
  };
};

export const createInsurancePositionFromTemplate = (
  options?: { baseMonth?: string | null; startMonth?: string | null }
): InsurancePositionDraft => {
  const startMonth = getDefaultStartMonth(
    normalizeMonth(options?.startMonth ?? "") ?? options?.baseMonth ?? null
  );

  return {
    id: createInsurancePositionId(),
    name: "",
    enabled: true,
    kind: "protection",
    startMonth,
    premiumMonthly: 1200,
    premiumAnnualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
    initialCashValue: 0,
    expectedAnnualReturnPct: DEFAULT_ANNUAL_GROWTH_PCT,
  };
};

export const formatHomeSummary = (
  t: Translator,
  home: HomePosition,
  currency: string,
  locale: string
) => {
  const usageLabel =
    (home.usage ?? "primary") === "investment"
      ? t("homeSummary.investment")
      : t("homeSummary.primary");
  const mode = home.mode ?? "new_purchase";
  const displayValue =
    mode === "existing" && home.existing
      ? home.existing.marketValue
      : home.purchasePrice ?? 0;
  const formattedPrice = formatCurrency(displayValue, currency, locale);

  if (mode === "existing" && home.existing) {
    const rate = home.existing.annualRatePct.toFixed(1);
    return t("homeSummary.existing", {
      usage: usageLabel,
      price: formattedPrice,
      termMonths: home.existing.remainingTermMonths,
      rate,
    });
  }

  const termYears = Math.round(home.mortgageTermYears ?? 0);
  const rate = (home.mortgageRatePct ?? 0).toFixed(1);
  return t("homeSummary.newPurchase", {
    usage: usageLabel,
    price: formattedPrice,
    termYears,
    rate,
  });
};

export const formatCarSummary = (
  t: Translator,
  car: CarPosition,
  currency: string,
  locale: string
) => {
  const formattedPrice = formatCurrency(car.purchasePrice ?? 0, currency, locale);
  const rate = (car.annualDepreciationRatePct ?? 0).toFixed(1);
  if (car.loan) {
    const loanRate = (car.loan.annualInterestRatePct ?? 0).toFixed(1);
    const loanTermYears = Math.round(car.loan.termYears ?? 0);
    return t("carSummary.withLoan", {
      price: formattedPrice,
      rate,
      loanTermYears,
      loanRate,
    });
  }

  return t("carSummary.noLoan", {
    price: formattedPrice,
    rate,
  });
};

const assetClassLabelMap: Record<NonNullable<InvestmentPosition["assetClass"]>, string> =
  {
    equity: "assetClassEquity",
    bond: "assetClassBond",
    fund: "assetClassFund",
    crypto: "assetClassCrypto",
  };

export const formatInvestmentSummary = (
  t: Translator,
  investment: InvestmentPosition,
  currency: string,
  locale: string
) => {
  const formattedValue = formatCurrency(investment.initialValue ?? 0, currency, locale);
  const assetClassLabel = investment.assetClass
    ? t(assetClassLabelMap[investment.assetClass])
    : t("assetClassNone");

  return t("investmentSummary.basic", {
    value: formattedValue,
    assetClass: assetClassLabel,
  });
};

export const formatLoanSummary = (
  t: Translator,
  loan: LoanPosition,
  currency: string,
  locale: string
) => {
  const formattedPrincipal = formatCurrency(loan.principal ?? 0, currency, locale);
  const rate = (loan.annualInterestRatePct ?? 0).toFixed(1);
  const termYears = Math.round(loan.termYears ?? 0);

  return t("loanSummary.basic", {
    principal: formattedPrincipal,
    rate,
    termYears,
  });
};

export const formatInsuranceSummary = (
  t: Translator,
  insurance: InsurancePosition,
  currency: string,
  locale: string
) => {
  const premium = formatCurrency(insurance.premiumMonthly ?? 0, currency, locale);
  const kindLabel =
    insurance.kind === "savings" ? t("kindSavings") : t("kindProtection");
  return t("insuranceSummary.basic", {
    kind: kindLabel,
    premium,
  });
};

const getSortKey = (view: ScenarioEventView) => {
  const startMonth = view.rule.startMonth ?? "9999-12";
  return `${startMonth}-${view.definition.title}`;
};

const sortViews = (views: ScenarioEventView[]) =>
  [...views].sort((a, b) => getSortKey(a).localeCompare(getSortKey(b)));

export type EventTreeRow = {
  view: ScenarioEventView;
  depth: number;
  hasChildren: boolean;
};

export const buildEventTreeRows = (
  views: ScenarioEventView[],
  activeGroup: "all" | EventGroup,
  collapsed: Record<string, boolean>
): EventTreeRow[] => {
  const viewMap = new Map(views.map((view) => [view.definition.id, view]));
  const childrenMap = new Map<string, ScenarioEventView[]>();
  const roots: ScenarioEventView[] = [];

  views.forEach((view) => {
    const parentId = view.definition.parentId;
    if (parentId && viewMap.has(parentId)) {
      const bucket = childrenMap.get(parentId) ?? [];
      bucket.push(view);
      childrenMap.set(parentId, bucket);
      return;
    }
    roots.push(view);
  });

  const rows: EventTreeRow[] = [];

  const shouldIncludeCashflow = (view: ScenarioEventView) =>
    activeGroup === "all" || getEventGroup(view.definition.type) === activeGroup;

  const walk = (view: ScenarioEventView, depth: number): boolean => {
    const children = sortViews(childrenMap.get(view.definition.id) ?? []);
    let hasMatchingChild = false;

    children.forEach((child) => {
      const childMatches = walk(child, depth + 1);
      hasMatchingChild = hasMatchingChild || childMatches;
    });

    const isGroup = view.definition.kind === "group";
    const shouldInclude = isGroup
      ? activeGroup === "all" || hasMatchingChild
      : shouldIncludeCashflow(view);

    if (!shouldInclude) {
      return false;
    }

    rows.push({
      view,
      depth,
      hasChildren: children.length > 0,
    });

    if (!isGroup || !collapsed[view.definition.id]) {
      children.forEach((child) => {
        walk(child, depth + 1);
      });
    }

    return true;
  };

  sortViews(roots).forEach((view) => {
    walk(view, 0);
  });

  return rows;
};
