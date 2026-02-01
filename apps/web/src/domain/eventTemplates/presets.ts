import { nanoid } from "nanoid";
import type { EventDefinition, EventRule } from "../events/types";
import type { EventType, IncomeSubtype } from "../../features/timeline/schema";
import { createEventDefinitionFromTemplate } from "../../../components/timeline/utils";
import { isValidMonthKey } from "../../utils/monthKey";
import type { TemplateDrawerType, TemplateId } from "./types";

type TemplatePreset = {
  drawerType: TemplateDrawerType;
  cashflow?: {
    kind: "income" | "expense";
    cadence: "monthly" | "quarterly" | "yearly" | "oneOff" | "everyNMonths";
    tags?: string[];
    amount?: number;
  };
  housing?: {
    kind: "rent" | "mortgage";
  };
  loan?: {
    loanKind: "personal" | "car" | "credit";
  };
  insurance?: {
    mode: "quick" | "detailed";
  };
  timeline?: {
    type: EventType;
    incomeSubtype?: IncomeSubtype;
    rule?: Partial<EventRule>;
  };
};

export type CashflowDraftOverrides = {
  label?: string;
  kind?: "income" | "expense";
  cadence?: "monthly" | "quarterly" | "yearly" | "oneOff" | "everyNMonths";
  amount?: string;
  startMonth?: string;
  endMonth?: string;
  occurrenceMonth?: string;
  everyNMonths?: string;
  memberId?: string;
  tags?: string[];
};

export type HousingDraftOverrides = {
  label?: string;
  kind?: "rent" | "mortgage";
  startMonth?: string;
  endMonth?: string;
  rentMonthly?: string;
  rentAnnualGrowthPct?: string;
  purchasePrice?: string;
  downPaymentMode?: "percent" | "amount";
  downPaymentPercent?: string;
  downPaymentAmount?: string;
  mortgageRatePct?: string;
  mortgageTermYears?: string;
  mortgagePayment?: string;
  memberId?: string;
};

export type LoanDraftOverrides = {
  label?: string;
  loanKind?: "personal" | "car" | "credit";
  startMonth?: string;
  principal?: string;
  annualInterestRatePct?: string;
  termYears?: string;
  monthlyPayment?: string;
  paymentMethod?: "amortization" | "manual";
  paymentIsEstimated?: boolean;
  purchasePrice?: string;
  downPaymentMode?: "percent" | "amount";
  downPaymentPercent?: string;
  downPaymentAmount?: string;
  memberId?: string;
};

export type InsurancePolicyDraftOverrides = {
  id: string;
  name: string;
  kind: "protection" | "savings";
  startMonth: string;
  endMonth: string;
  premiumMonthly: string;
  premiumAnnualGrowthPct: string;
  cashValue: string;
  expectedAnnualReturnPct: string;
  policyId: string;
  policyAssetId: string;
};

export type InsuranceDraftOverrides = {
  label?: string;
  mode?: "quick" | "detailed";
  startMonth?: string;
  endMonth?: string;
  premiumMonthly?: string;
  premiumAnnualGrowthPct?: string;
  policies?: InsurancePolicyDraftOverrides[];
  memberId?: string;
};

export type TemplateDrawerDraftOverrides = {
  drawerType: TemplateDrawerType;
  cashflow?: CashflowDraftOverrides;
  housing?: HousingDraftOverrides;
  loan?: LoanDraftOverrides;
  insurance?: InsuranceDraftOverrides;
};

const templatePresets: Record<TemplateId, TemplatePreset> = {
  monthly_salary: {
    drawerType: "cashflow",
    cashflow: { kind: "income", cadence: "monthly" },
    timeline: { type: "salary", incomeSubtype: "salary" },
  },
  salary_adjustment: {
    drawerType: "cashflow",
    cashflow: { kind: "income", cadence: "monthly", tags: ["adjustment"] },
    timeline: {
      type: "salary",
      incomeSubtype: "salary",
      rule: { monthlyAmount: 1000, annualGrowthPct: 0 },
    },
  },
  bonus_13th: {
    drawerType: "cashflow",
    cashflow: { kind: "income", cadence: "oneOff" },
    timeline: {
      type: "salary",
      incomeSubtype: "bonus",
      rule: { monthlyAmount: 0, oneTimeAmount: 6000 },
    },
  },
  rental_income: {
    drawerType: "cashflow",
    cashflow: { kind: "income", cadence: "monthly" },
    timeline: {
      type: "salary",
      incomeSubtype: "rental",
      rule: { monthlyAmount: 1500 },
    },
  },
  dividends_interest: {
    drawerType: "cashflow",
    cashflow: { kind: "income", cadence: "monthly" },
    timeline: {
      type: "salary",
      incomeSubtype: "dividend",
      rule: { monthlyAmount: 300 },
    },
  },
  living_total: {
    drawerType: "cashflow",
    cashflow: { kind: "expense", cadence: "monthly" },
    timeline: {
      type: "custom",
      rule: { monthlyAmount: 2000 },
    },
  },
  living_breakdown: {
    drawerType: "cashflow",
    cashflow: { kind: "expense", cadence: "monthly" },
    timeline: {
      type: "custom",
      rule: { monthlyAmount: 800 },
    },
  },
  rent_housing: {
    drawerType: "housing",
    housing: { kind: "rent" },
    timeline: {
      type: "rent",
      rule: { monthlyAmount: 1800 },
    },
  },
  insurance_quick: {
    drawerType: "insurance",
    insurance: { mode: "quick" },
    timeline: {
      type: "insurance",
      rule: { monthlyAmount: 300 },
    },
  },
  insurance_detailed: {
    drawerType: "insurance",
    insurance: { mode: "detailed" },
    timeline: {
      type: "insurance_product",
      rule: { monthlyAmount: 300 },
    },
  },
  childcare_monthly: {
    drawerType: "cashflow",
    cashflow: { kind: "expense", cadence: "monthly" },
    timeline: {
      type: "baby",
      rule: { monthlyAmount: 900 },
    },
  },
  one_time_big_expense: {
    drawerType: "cashflow",
    cashflow: { kind: "expense", cadence: "oneOff" },
    timeline: {
      type: "travel",
      rule: { monthlyAmount: 0, oneTimeAmount: 4000 },
    },
  },
  mortgage_home_purchase: {
    drawerType: "housing",
    housing: { kind: "mortgage" },
    timeline: {
      type: "buy_home",
      rule: { oneTimeAmount: 800000 },
    },
  },
  housing_fees_rates: {
    drawerType: "cashflow",
    cashflow: { kind: "expense", cadence: "monthly", tags: ["housing"] },
    timeline: {
      type: "custom",
      rule: { monthlyAmount: 300 },
    },
  },
  buy_car: {
    drawerType: "cashflow",
    cashflow: { kind: "expense", cadence: "oneOff", tags: ["car"] },
    timeline: {
      type: "car",
      rule: { monthlyAmount: 600, oneTimeAmount: 20000 },
    },
  },
  monthly_investing: {
    drawerType: "cashflow",
    cashflow: { kind: "expense", cadence: "monthly", tags: ["investing"] },
    timeline: {
      type: "investment_contribution",
      rule: { monthlyAmount: 500 },
    },
  },
  personal_loan: {
    drawerType: "loan",
    loan: { loanKind: "personal" },
    timeline: {
      type: "custom",
      rule: { monthlyAmount: 1000 },
    },
  },
  car_loan: {
    drawerType: "loan",
    loan: { loanKind: "car" },
    timeline: {
      type: "custom",
      rule: { monthlyAmount: 1200 },
    },
  },
  credit_card_balance: {
    drawerType: "loan",
    loan: { loanKind: "credit" },
    timeline: {
      type: "custom",
      rule: { monthlyAmount: 500 },
    },
  },
};

export const getTemplatePreset = (templateId: TemplateId) => templatePresets[templateId];

type BuildDraftOptions = {
  baseMonth?: string | null;
  label?: string;
};

const resolveBaseMonth = (baseMonth?: string | null) =>
  baseMonth && isValidMonthKey(baseMonth) ? baseMonth : "";

export const buildTemplateDrawerDraftOverrides = (
  templateId: TemplateId,
  options: BuildDraftOptions = {}
): TemplateDrawerDraftOverrides => {
  const preset = getTemplatePreset(templateId);
  const baseMonth = resolveBaseMonth(options.baseMonth);
  const label = options.label ?? "";

  if (preset.drawerType === "cashflow") {
    const cadence = preset.cashflow?.cadence ?? "monthly";
    return {
      drawerType: "cashflow",
      cashflow: {
        label,
        kind: preset.cashflow?.kind ?? "income",
        cadence,
        startMonth: cadence === "oneOff" ? "" : baseMonth,
        occurrenceMonth: cadence === "oneOff" ? baseMonth : "",
        tags: preset.cashflow?.tags,
      },
    };
  }

  if (preset.drawerType === "housing") {
    return {
      drawerType: "housing",
      housing: {
        label,
        kind: preset.housing?.kind ?? "rent",
        startMonth: baseMonth,
      },
    };
  }

  if (preset.drawerType === "loan") {
    return {
      drawerType: "loan",
      loan: {
        label,
        loanKind: preset.loan?.loanKind ?? "personal",
        startMonth: baseMonth,
      },
    };
  }

  if (preset.drawerType === "insurance") {
    const mode = preset.insurance?.mode ?? "quick";
    const detailedPolicies =
      mode === "detailed"
        ? [
            {
              id: `policy_${nanoid(8)}`,
              name: "",
              kind: "protection" as const,
              startMonth: baseMonth,
              endMonth: "",
              premiumMonthly: "",
              premiumAnnualGrowthPct: "",
              cashValue: "",
              expectedAnnualReturnPct: "",
              policyId: `policy_${nanoid(8)}`,
              policyAssetId: `asset_policy_${nanoid(8)}`,
            },
          ]
        : [];
    return {
      drawerType: "insurance",
      insurance: {
        label,
        mode,
        startMonth: baseMonth,
        policies: detailedPolicies,
      },
    };
  }

  return { drawerType: "cashflow" };
};

type BuildTimelineOptions = {
  baseCurrency?: string;
  baseMonth?: string | null;
  memberId?: string;
};

export const buildTimelineDefinitionFromTemplate = (
  templateId: TemplateId,
  t: (key: string, values?: Record<string, string | number>) => string,
  options: BuildTimelineOptions = {}
): EventDefinition => {
  const preset = getTemplatePreset(templateId);
  const timelinePreset = preset.timeline ?? { type: "custom" };
  const definition = createEventDefinitionFromTemplate(timelinePreset.type, t, options);

  return {
    ...definition,
    incomeSubtype: timelinePreset.incomeSubtype ?? definition.incomeSubtype,
    rule: {
      ...definition.rule,
      ...timelinePreset.rule,
    },
  };
};
