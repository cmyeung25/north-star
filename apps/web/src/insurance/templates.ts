import type { TimelineEvent } from "../store/scenarioStore";

export type InsuranceTemplateId =
  | "pay_5_years"
  | "hk_annuity"
  | "withdraw_after_8_years";

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
    params: Record<string, number>
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
  durationMonths: number
): TimelineEvent => ({
  ...event,
  type: "insurance_premium",
  name: `${event.name} ${nameSuffix}`.trim(),
  startMonth: event.startMonth,
  endMonth: endMonthFromDuration(event.startMonth, durationMonths),
  monthlyAmount: Math.abs(event.monthlyAmount ?? 0),
  oneTimeAmount: 0,
  annualGrowthPct: 0,
});

const buildMonthlyBenefitEvent = (
  event: TimelineEvent,
  nameSuffix: string,
  monthlyAmount: number,
  durationMonths: number
): TimelineEvent => ({
  ...event,
  type: "insurance_payout",
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
    id: "pay_5_years",
    params: [{ key: "premiumYears", defaultValue: 5, min: 1 }],
    buildEvents: (event, params) => {
      const premiumYears = params.premiumYears ?? 5;
      const premiumMonths = Math.max(Math.round(premiumYears * 12), 1);
      return [buildPremiumEvent(event, "premium", premiumMonths)];
    },
  },
  {
    id: "hk_annuity",
    params: [
      { key: "premiumYears", defaultValue: 5, min: 1 },
      { key: "taxDeductionAnnual", defaultValue: 6000, min: 0 },
      { key: "taxDeductionYears", defaultValue: 5, min: 0 },
    ],
    buildEvents: (event, params) => {
      const premiumYears = params.premiumYears ?? 5;
      const taxYears = params.taxDeductionYears ?? 0;
      const premiumMonths = Math.max(Math.round(premiumYears * 12), 1);
      const taxMonths = Math.max(Math.round(taxYears * 12), 0);
      const taxMonthly =
        taxMonths > 0 ? (params.taxDeductionAnnual ?? 0) / 12 : 0;

      const events: TimelineEvent[] = [
        buildPremiumEvent(event, "premium", premiumMonths),
      ];
      if (taxMonthly > 0 && taxMonths > 0) {
        events.push(
          buildMonthlyBenefitEvent(event, "tax benefit", taxMonthly, taxMonths)
        );
      }
      return events;
    },
  },
  {
    id: "withdraw_after_8_years",
    params: [
      { key: "premiumYears", defaultValue: 5, min: 1 },
      { key: "withdrawalAfterYears", defaultValue: 8, min: 1 },
      { key: "withdrawalAmount", defaultValue: 120000, min: 0 },
    ],
    buildEvents: (event, params) => {
      const premiumYears = params.premiumYears ?? 5;
      const payoutAfterYears = params.withdrawalAfterYears ?? 8;
      const premiumMonths = Math.max(Math.round(premiumYears * 12), 1);
      const payoutAfterMonths = Math.max(Math.round(payoutAfterYears * 12), 0);
      const payoutAmount = params.withdrawalAmount ?? 0;
      return [
        buildPremiumEvent(event, "premium", premiumMonths),
        buildOneTimePayoutEvent(event, "withdrawal", payoutAmount, payoutAfterMonths),
      ];
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
