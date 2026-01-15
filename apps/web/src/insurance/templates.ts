import type { ScenarioAssumptions, TimelineEvent } from "../store/scenarioStore";

export type InsuranceTemplateId =
  | "savings_pay_2_return_5"
  | "hk_annuity_tax_deduct_pay_5_withdraw_8";

export type InsuranceTemplateParam = {
  key: string;
  defaultValue: number;
  min?: number;
};

export type InsuranceTemplate = {
  id: InsuranceTemplateId;
  params: InsuranceTemplateParam[];
  buildEvents: (
    event: TimelineEvent,
    params: Record<string, number>,
    assumptions?: ScenarioAssumptions
  ) => Array<Omit<TimelineEvent, "id" | "templateId" | "templateParams" | "derived" | "sourceId">>;
};

const formatMonth = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const addMonths = (month: string, offset: number) => {
  const [year, monthValue] = month.split("-").map(Number);
  const date = new Date(year, monthValue - 1 + offset, 1);
  return formatMonth(date);
};

const endMonthFromDuration = (startMonth: string, durationMonths: number) => {
  if (durationMonths <= 0) {
    return startMonth;
  }
  return addMonths(startMonth, durationMonths - 1);
};

const buildPremiumEvent = (
  event: TimelineEvent,
  nameSuffix: string,
  durationMonths: number,
  monthlyAmount: number
): TimelineEvent => ({
  ...event,
  type: "insurance_premium",
  name: `${event.name} ${nameSuffix}`.trim(),
  startMonth: event.startMonth,
  endMonth: endMonthFromDuration(event.startMonth, durationMonths),
  monthlyAmount: Math.abs(monthlyAmount),
  oneTimeAmount: 0,
  annualGrowthPct: 0,
});

const buildMonthlyBenefitEvent = (
  event: TimelineEvent,
  nameSuffix: string,
  monthlyAmount: number,
  durationMonths: number,
  type: TimelineEvent["type"] = "insurance_payout"
): TimelineEvent => ({
  ...event,
  type,
  name: `${event.name} ${nameSuffix}`.trim(),
  startMonth: event.startMonth,
  endMonth: endMonthFromDuration(event.startMonth, durationMonths),
  monthlyAmount: Math.abs(monthlyAmount),
  oneTimeAmount: 0,
  annualGrowthPct: 0,
});

const buildOneTimePayoutEvent = (
  event: TimelineEvent,
  nameSuffix: string,
  payoutAmount: number,
  payoutAfterMonths: number
): TimelineEvent => ({
  ...event,
  type: "insurance_payout",
  name: `${event.name} ${nameSuffix}`.trim(),
  startMonth: addMonths(event.startMonth, payoutAfterMonths),
  endMonth: null,
  monthlyAmount: 0,
  oneTimeAmount: Math.abs(payoutAmount),
  annualGrowthPct: 0,
});

export const insuranceTemplates: InsuranceTemplate[] = [
  {
    id: "savings_pay_2_return_5",
    params: [
      { key: "premiumMonthly", defaultValue: 0, min: 0 },
      { key: "premiumAnnual", defaultValue: 0, min: 0 },
      { key: "payMonths", defaultValue: 24, min: 1 },
      { key: "returnMonthOffset", defaultValue: 60, min: 1 },
      { key: "returnAmount", defaultValue: 60000, min: 0 },
    ],
    buildEvents: (event, params) => {
      const premiumMonthlyParam = params.premiumMonthly ?? 0;
      const premiumAnnualParam = params.premiumAnnual ?? 0;
      const premiumMonthly =
        premiumMonthlyParam > 0
          ? premiumMonthlyParam
          : premiumAnnualParam > 0
            ? premiumAnnualParam / 12
            : event.monthlyAmount ?? 0;
      const premiumMonths = Math.max(Math.round(params.payMonths ?? 24), 1);
      const payoutAfterMonths = Math.max(Math.round(params.returnMonthOffset ?? 60), 0);
      const payoutAmount = params.returnAmount ?? 0;

      return [
        buildPremiumEvent(event, "premium", premiumMonths, premiumMonthly),
        buildOneTimePayoutEvent(event, "return", payoutAmount, payoutAfterMonths),
      ];
    },
  },
  {
    id: "hk_annuity_tax_deduct_pay_5_withdraw_8",
    params: [
      { key: "annualPremium", defaultValue: 60000, min: 0 },
      { key: "payYears", defaultValue: 5, min: 1 },
      { key: "withdrawAfterYears", defaultValue: 8, min: 1 },
      { key: "withdrawAmount", defaultValue: 120000, min: 0 },
      { key: "taxBenefitAnnual", defaultValue: 6000, min: 0 },
    ],
    buildEvents: (event, params) => {
      const annualPremium = params.annualPremium ?? 0;
      const payYears = params.payYears ?? 5;
      const withdrawAfterYears = params.withdrawAfterYears ?? 8;
      const taxBenefitAnnual = params.taxBenefitAnnual ?? 0;
      const withdrawAmount = params.withdrawAmount ?? 0;
      const premiumMonths = Math.max(Math.round(payYears * 12), 1);
      const payoutAfterMonths = Math.max(Math.round(withdrawAfterYears * 12), 0);
      const monthlyPremium = annualPremium / 12;
      const taxBenefitMonthly = taxBenefitAnnual / 12;

      const events: TimelineEvent[] = [
        buildPremiumEvent(event, "premium", premiumMonths, monthlyPremium),
      ];
      if (taxBenefitMonthly > 0) {
        events.push(
          buildMonthlyBenefitEvent(
            event,
            "tax benefit",
            taxBenefitMonthly,
            premiumMonths,
            "tax_benefit"
          )
        );
      }
      events.push(
        buildOneTimePayoutEvent(event, "withdrawal", withdrawAmount, payoutAfterMonths)
      );
      return events;
    },
  },
];

export const getInsuranceTemplate = (id?: string | null) =>
  insuranceTemplates.find((template) => template.id === id) ?? insuranceTemplates[0];

export const buildTemplateParams = (
  template: InsuranceTemplate,
  params?: Record<string, number>
) =>
  template.params.reduce<Record<string, number>>((acc, param) => {
    acc[param.key] = params?.[param.key] ?? param.defaultValue;
    return acc;
  }, {});

export const buildDerivedEvents = (
  event: TimelineEvent,
  assumptions?: ScenarioAssumptions
): TimelineEvent[] => {
  if (event.type !== "insurance_product" || !event.enabled) {
    return [];
  }

  const template = getInsuranceTemplate(event.templateId);
  const templateParams = buildTemplateParams(template, event.templateParams);
  const derivedEvents = template.buildEvents(event, templateParams, assumptions);

  return derivedEvents.map((derivedEvent, index) => ({
    ...derivedEvent,
    id: `${event.id}-derived-${index}`,
    derived: true,
    sourceId: event.id,
    templateId: undefined,
    templateParams: undefined,
  }));
};
