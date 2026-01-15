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
import { normalizeEvent, normalizeMonth } from "../../src/features/timeline/schema";
import {
  buildTemplateParams,
  getInsuranceTemplate,
} from "../../src/insurance/templates";
import {
  createHomePositionId,
  type HomePosition,
  type HomePositionDraft,
} from "../../src/store/scenarioStore";
import type { TimelineEvent } from "./types";

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
  rent: { monthlyAmount: 1800, oneTimeAmount: 0, annualGrowthPct: 3 },
  salary: { monthlyAmount: 6000, oneTimeAmount: 0, annualGrowthPct: 3 },
  buy_home: { monthlyAmount: 0, oneTimeAmount: 800000, annualGrowthPct: 0 },
  baby: { monthlyAmount: 900, oneTimeAmount: 5000, annualGrowthPct: 2 },
  car: { monthlyAmount: 600, oneTimeAmount: 20000, annualGrowthPct: 0 },
  travel: { monthlyAmount: 0, oneTimeAmount: 4000, annualGrowthPct: 0 },
  insurance: { monthlyAmount: 250, oneTimeAmount: 0, annualGrowthPct: 0 },
  insurance_product: { monthlyAmount: 300, oneTimeAmount: 0, annualGrowthPct: 0 },
  insurance_premium: { monthlyAmount: 300, oneTimeAmount: 0, annualGrowthPct: 0 },
  insurance_payout: { monthlyAmount: 0, oneTimeAmount: 15000, annualGrowthPct: 0 },
  tax_benefit: { monthlyAmount: 0, oneTimeAmount: 6000, annualGrowthPct: 0 },
  helper: { monthlyAmount: 600, oneTimeAmount: 0, annualGrowthPct: 0 },
  investment_contribution: { monthlyAmount: 500, oneTimeAmount: 0, annualGrowthPct: 0 },
  investment_withdrawal: { monthlyAmount: 0, oneTimeAmount: 5000, annualGrowthPct: 0 },
  custom: { monthlyAmount: 0, oneTimeAmount: 0, annualGrowthPct: 0 },
};

type CreateEventOptions = {
  baseCurrency?: string;
  baseMonth?: string | null;
  memberId?: string;
};

export const createEventFromTemplate = (
  type: EventType,
  t: Translator,
  options: CreateEventOptions = {}
): TimelineEvent => {
  const label = getEventLabel(t, type);
  const defaults = templateDefaults[type];
  const startMonth = getDefaultStartMonth(options.baseMonth);
  const insuranceTemplate =
    type === "insurance_product" ? getInsuranceTemplate() : null;
  const templateParams = insuranceTemplate
    ? buildTemplateParams(insuranceTemplate)
    : undefined;

  return normalizeEvent(
    {
      id: createEventId(),
      type,
      name: t("timelineEventPlan", { label }),
      startMonth,
      endMonth: null,
      enabled: true,
      monthlyAmount: defaults.monthlyAmount,
      oneTimeAmount: defaults.oneTimeAmount,
      annualGrowthPct: defaults.annualGrowthPct,
      currency: options.baseCurrency ?? defaultCurrency,
      memberId: options.memberId,
      templateId: insuranceTemplate?.id,
      templateParams,
    },
    {
      baseCurrency: options.baseCurrency ?? defaultCurrency,
      fallbackMonth: startMonth,
    }
  );
};

export const createHomePositionFromTemplate = (
  options?: { baseMonth?: string | null; purchaseMonth?: string | null }
): HomePositionDraft => {
  const purchaseMonth = getDefaultStartMonth(
    normalizeMonth(options?.purchaseMonth ?? "") ?? options?.baseMonth ?? null
  );
  const purchasePrice = 9_000_000;
  const downPayment = 1_800_000;

  return {
    id: createHomePositionId(),
    usage: "primary",
    mode: "new_purchase",
    purchasePrice,
    downPayment,
    purchaseMonth,
    annualAppreciationPct: 2,
    mortgageRatePct: 3.5,
    mortgageTermYears: 30,
    feesOneTime: 300_000,
    holdingCostMonthly: 0,
    holdingCostAnnualGrowthPct: 0,
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
