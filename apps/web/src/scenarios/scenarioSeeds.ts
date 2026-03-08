import type { ScenarioEventDraft, MonthKey } from "../domain/scenarioV2/events";
import type {
  ScenarioAsset,
  ScenarioAssumptions,
  ScenarioLiability,
  ScenarioMember,
  BundleInstanceRecord,
} from "../store/scenarioStore";
import type {
  HomePurchaseBundleInput,
  NewBabyPlanInput,
  NewBabyPlanLabels,
} from "../domain/eventTemplates/bundles";
import {
  buildHomePurchaseBundleEvent,
  buildNewBabyBundleEvents,
} from "../domain/eventTemplates/bundles";
import { addMonths } from "../domain/members/age";
import { defaultCurrency } from "../../lib/i18n";

export type ScenarioSeedTranslator = ((
  key: string,
  values?: Record<string, string | number>
) => string) & { raw: (key: string) => unknown };

export type ScenarioSeedKeyNumber = {
  labelKey: string;
  metric:
    | "monthlyIncome"
    | "monthlyExpense"
    | "cash"
    | "investments"
    | "property"
    | "mortgage"
    | "rentalIncome";
};

export type ScenarioSeedSummary = {
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyNet: number;
  assetsTotal: number;
  liabilitiesTotal: number;
  cashTotal: number;
  investmentTotal: number;
  propertyTotal: number;
  mortgageTotal: number;
  rentalIncome: number;
  bundles: { id: string; title: string; startMonth: MonthKey }[];
};

export type ScenarioSeedBundleSummary = {
  id: string;
  title: string;
  startMonth: MonthKey;
};

export type ScenarioSeedPayload = {
  baseMonth: MonthKey;
  baseCurrency?: string;
  initialCash: number;
  assumptions?: Partial<ScenarioAssumptions>;
  members: ScenarioMember[];
  assets: ScenarioAsset[];
  liabilities: ScenarioLiability[];
  events: ScenarioEventDraft[];
  bundleInstances: BundleInstanceRecord[];
  bundleSummaries: ScenarioSeedBundleSummary[];
};

export type ScenarioSeedCard = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  keyNumbers: { label: string; value: string }[];
  payload: ScenarioSeedPayload;
  summary: ScenarioSeedSummary;
};

type ScenarioSeedDefinition = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  tagsKey: string;
  keyNumbers: ScenarioSeedKeyNumber[];
  buildPayload: (t: ScenarioSeedTranslator) => ScenarioSeedPayload;
};

const SEED_HORIZON_MONTHS = 120;

const resolveMessageValue = (messages: Record<string, unknown>, key: string): unknown =>
  key.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, messages);

const interpolateMessage = (
  template: string,
  values?: Record<string, string | number>
): string => {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, token) => {
    const value = values[token];
    return value === undefined ? match : String(value);
  });
};

export const createScenarioSeedTranslatorFromMessages = (
  messages: Record<string, unknown>
): ScenarioSeedTranslator => {
  const translator = ((key: string, values?: Record<string, string | number>) => {
    const resolved = resolveMessageValue(messages, key);
    return typeof resolved === "string" ? interpolateMessage(resolved, values) : key;
  }) as ScenarioSeedTranslator;

  translator.raw = (key: string) => resolveMessageValue(messages, key);

  return translator;
};

const offsetMonth = (baseMonth: MonthKey, deltaMonths: number): MonthKey =>
  addMonths(baseMonth, deltaMonths) as MonthKey;

const buildMember = (
  id: string,
  name: string,
  birthMonth?: MonthKey
): ScenarioMember => ({
  id,
  name,
  kind: "person",
  birthMonth,
});

const buildInvestmentReturnAssumptions = (rate: number) => ({
  equity: rate,
  bond: rate,
  fund: rate,
  crypto: rate,
});

const buildSeedAssumptions = (
  baseMonth: MonthKey,
  overrides: Partial<ScenarioAssumptions>
): Partial<ScenarioAssumptions> => ({
  baseMonth,
  horizonMonths: SEED_HORIZON_MONTHS,
  ...overrides,
});

const buildAsset = ({
  id,
  kind,
  label,
  currentValue,
  startMonth,
}: {
  id: string;
  kind: ScenarioAsset["kind"];
  label: string;
  currentValue: number;
  startMonth: MonthKey;
}): ScenarioAsset => ({
  id,
  kind,
  label,
  currentValue,
  startMonth,
  source: "manual",
});

const buildMonthlyCashflow = ({
  id,
  kind,
  label,
  amount,
  startMonth,
  memberId,
}: {
  id: string;
  kind: "income" | "expense";
  label: string;
  amount: number;
  startMonth: MonthKey;
  memberId?: string;
}): ScenarioEventDraft => ({
  id,
  type: "cashflow",
  kind,
  cadence: "monthly",
  amount,
  startMonth,
  label,
  memberId,
});

const buildOneOffExpense = ({
  id,
  label,
  amount,
  occurrenceMonth,
  memberId,
}: {
  id: string;
  label: string;
  amount: number;
  occurrenceMonth: MonthKey;
  memberId?: string;
}): ScenarioEventDraft => ({
  id,
  type: "cashflow",
  kind: "expense",
  cadence: "oneOff",
  amount,
  occurrenceMonth,
  label,
  memberId,
});

const buildBundleRecord = (
  id: string,
  wizardInput: BundleInstanceRecord["wizardInput"]
): BundleInstanceRecord => ({
  id,
  wizardInput,
  updatedAt: Date.now(),
});

const summarizeScenarioSeedPayload = (
  payload: ScenarioSeedPayload
): ScenarioSeedSummary => {
  let monthlyIncome = 0;
  let monthlyExpense = 0;
  let assetsTotal = 0;
  let liabilitiesTotal = 0;
  let cashTotal = 0;
  let investmentTotal = 0;
  let propertyTotal = 0;
  let mortgageTotal = 0;
  let rentalIncome = 0;

  payload.assets.forEach((asset) => {
    if (typeof asset.currentValue === "number") {
      assetsTotal += asset.currentValue;
      if (asset.kind === "cash") {
        cashTotal += asset.currentValue;
      }
      if (asset.kind === "investment") {
        investmentTotal += asset.currentValue;
      }
    }
  });

  payload.liabilities.forEach((liability) => {
    if (typeof liability.principalOutstanding === "number") {
      liabilitiesTotal += liability.principalOutstanding;
      if (liability.kind === "mortgage") {
        mortgageTotal += liability.principalOutstanding;
      }
    }
  });

  payload.events.forEach((event) => {
    if (event.type === "cashflow") {
      if (event.cadence !== "monthly") {
        return;
      }
      if (event.kind === "income") {
        monthlyIncome += event.amount;
      } else {
        monthlyExpense += event.amount;
      }
      return;
    }

    if (event.type === "housing") {
      if (event.kind === "rent" && typeof event.rentMonthly === "number") {
        monthlyExpense += event.rentMonthly;
      }
      if (event.kind === "mortgage") {
        const propertyMarketValue =
          event.propertyMarketValue ?? event.purchasePrice ?? 0;
        const mortgageBaseValue =
          event.mortgageBaseValue ?? event.purchasePrice ?? propertyMarketValue;
        if (typeof event.mortgagePayment === "number") {
          monthlyExpense += event.mortgagePayment;
        }
        const ongoing =
          event.ongoingCosts?.reduce((total, cost) => total + cost.amount, 0) ?? 0;
        monthlyExpense += ongoing;
        if (event.rental?.enabled && typeof event.rental.rentMonthly === "number") {
          monthlyIncome += event.rental.rentMonthly;
          rentalIncome += event.rental.rentMonthly;
        }
        if (propertyMarketValue > 0) {
          assetsTotal += propertyMarketValue;
          propertyTotal += propertyMarketValue;
          const downPaymentAmount =
            event.downPaymentMode === "amount"
              ? event.downPaymentAmount ?? 0
              : (propertyMarketValue * (event.downPaymentPercent ?? 0)) / 100;
          const mortgageOutstanding = Math.max(0, mortgageBaseValue - downPaymentAmount);
          liabilitiesTotal += mortgageOutstanding;
          mortgageTotal += mortgageOutstanding;
        }
      }
    }

    if (event.type === "loan" && typeof event.monthlyPayment === "number") {
      monthlyExpense += event.monthlyPayment;
    }
  });

  return {
    monthlyIncome,
    monthlyExpense,
    monthlyNet: monthlyIncome - monthlyExpense,
    assetsTotal,
    liabilitiesTotal,
    cashTotal,
    investmentTotal,
    propertyTotal,
    mortgageTotal,
    rentalIncome,
    bundles: payload.bundleSummaries,
  };
};

const getKeyNumberValue = (summary: ScenarioSeedSummary, metric: ScenarioSeedKeyNumber["metric"]) => {
  switch (metric) {
    case "monthlyIncome":
      return summary.monthlyIncome;
    case "monthlyExpense":
      return summary.monthlyExpense;
    case "cash":
      return summary.cashTotal;
    case "investments":
      return summary.investmentTotal;
    case "property":
      return summary.propertyTotal;
    case "mortgage":
      return summary.mortgageTotal;
    case "rentalIncome":
      return summary.rentalIncome;
    default:
      return 0;
  }
};

const normalizeSeedTags = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((tag): tag is string => typeof tag === "string");
  }

  if (value && typeof value === "object") {
    return Object.values(value).filter((tag): tag is string => typeof tag === "string");
  }

  return [];
};

const seedDefinitions: ScenarioSeedDefinition[] = [
  {
    id: "single-renter",
    titleKey: "scenarios.seeds.profiles.singleRenter.title",
    descriptionKey: "scenarios.seeds.profiles.singleRenter.description",
    tagsKey: "scenarios.seeds.profiles.singleRenter.tags",
    keyNumbers: [
      {
        labelKey: "scenarios.seeds.keyNumbers.monthlyIncome",
        metric: "monthlyIncome",
      },
      {
        labelKey: "scenarios.seeds.keyNumbers.monthlyExpense",
        metric: "monthlyExpense",
      },
      {
        labelKey: "scenarios.seeds.keyNumbers.cash",
        metric: "cash",
      },
    ],
    buildPayload: (t) => {
      const baseMonth: MonthKey = "2026-02";
      const memberBirthMonth = offsetMonth(baseMonth, -30 * 12);
      const memberId = "self";
      const members = [
        buildMember(
          memberId,
          t("scenarios.seeds.profiles.singleRenter.memberName"),
          memberBirthMonth
        ),
      ];
      const assets = [
        buildAsset({
          id: "seed-single-cash",
          kind: "cash",
          label: t("scenarios.seeds.assetLabels.cash"),
          currentValue: 50000,
          startMonth: baseMonth,
        }),
        buildAsset({
          id: "seed-single-invest",
          kind: "investment",
          label: t("scenarios.seeds.assetLabels.investments"),
          currentValue: 80000,
          startMonth: baseMonth,
        }),
      ];
      const events = [
        buildMonthlyCashflow({
          id: "seed-single-income",
          kind: "income",
          label: t("scenarios.seeds.eventLabels.salary"),
          amount: 25000,
          startMonth: baseMonth,
          memberId,
        }),
        buildMonthlyCashflow({
          id: "seed-single-rent",
          kind: "expense",
          label: t("scenarios.seeds.eventLabels.rent"),
          amount: 12000,
          startMonth: baseMonth,
        }),
        buildMonthlyCashflow({
          id: "seed-single-living",
          kind: "expense",
          label: t("scenarios.seeds.eventLabels.living"),
          amount: 6000,
          startMonth: baseMonth,
        }),
      ];
      const payload: ScenarioSeedPayload = {
        baseMonth,
        baseCurrency: defaultCurrency,
        initialCash: 50000,
        assumptions: buildSeedAssumptions(baseMonth, {
          inflationRate: 2.5,
          salaryGrowthRate: 3,
          rentAnnualGrowthPct: 2,
          investmentReturnAssumptions: buildInvestmentReturnAssumptions(5),
        }),
        members,
        assets,
        liabilities: [],
        events,
        bundleInstances: [],
        bundleSummaries: [],
      };
      return payload;
    },
  },
  {
    id: "dual-income-home",
    titleKey: "scenarios.seeds.profiles.dualIncomeHome.title",
    descriptionKey: "scenarios.seeds.profiles.dualIncomeHome.description",
    tagsKey: "scenarios.seeds.profiles.dualIncomeHome.tags",
    keyNumbers: [
      {
        labelKey: "scenarios.seeds.keyNumbers.monthlyIncome",
        metric: "monthlyIncome",
      },
      {
        labelKey: "scenarios.seeds.keyNumbers.propertyValue",
        metric: "property",
      },
      {
        labelKey: "scenarios.seeds.keyNumbers.mortgageBalance",
        metric: "mortgage",
      },
    ],
    buildPayload: (t) => {
      const baseMonth: MonthKey = "2026-02";
      const memberA = "self";
      const memberB = "spouse";
      const memberABirthMonth = offsetMonth(baseMonth, -32 * 12);
      const memberBBirthMonth = offsetMonth(baseMonth, -31 * 12);
      const members = [
        buildMember(
          memberA,
          t("scenarios.seeds.profiles.dualIncomeHome.memberNameA"),
          memberABirthMonth
        ),
        buildMember(
          memberB,
          t("scenarios.seeds.profiles.dualIncomeHome.memberNameB"),
          memberBBirthMonth
        ),
      ];
      const assets = [
        buildAsset({
          id: "seed-couple-cash",
          kind: "cash",
          label: t("scenarios.seeds.assetLabels.cash"),
          currentValue: 200000,
          startMonth: baseMonth,
        }),
        buildAsset({
          id: "seed-couple-invest",
          kind: "investment",
          label: t("scenarios.seeds.assetLabels.investments"),
          currentValue: 50000,
          startMonth: baseMonth,
        }),
      ];

      const homeBundleId = "seed-dual-income-home";
      const homeBundleTitle = t("scenarios.seeds.bundleLabels.homePurchase");
      const homeInput: HomePurchaseBundleInput = {
        bundleId: homeBundleId,
        label: homeBundleTitle,
        startMonth: baseMonth,
        propertyMarketValue: 6000000,
        mortgageBaseValue: 6000000,
        purchasePrice: 6000000,
        downPaymentMode: "percent",
        downPaymentPercent: 20,
        mortgageRatePct: 3.5,
        mortgageTermYears: 30,
        mortgagePayment: 20000,
        feesOneOff: [
          {
            id: "seed-home-fee-stamp",
            label: t("scenarios.seeds.eventLabels.stampDuty"),
            amount: 200000,
            month: baseMonth,
          },
          {
            id: "seed-home-fee-legal",
            label: t("scenarios.seeds.eventLabels.legalFee"),
            amount: 60000,
            month: baseMonth,
          },
        ],
        ongoingCosts: [
          {
            id: "seed-home-fee-management",
            label: t("scenarios.seeds.eventLabels.managementFee"),
            amount: 1500,
            startMonth: baseMonth,
          },
        ],
      };
      const homeEvent = buildHomePurchaseBundleEvent(
        homeInput,
        {
          bundleInstanceId: homeBundleId,
          templateId: "life_home_purchase",
          bundleTitle: homeBundleTitle,
        },
        () => "evt_seed_dual_income_home"
      );

      const events = [
        buildMonthlyCashflow({
          id: "seed-couple-income-a",
          kind: "income",
          label: t("scenarios.seeds.eventLabels.salary"),
          amount: 35000,
          startMonth: baseMonth,
          memberId: memberA,
        }),
        buildMonthlyCashflow({
          id: "seed-couple-income-b",
          kind: "income",
          label: t("scenarios.seeds.eventLabels.salary"),
          amount: 30000,
          startMonth: baseMonth,
          memberId: memberB,
        }),
        {
          id: "seed-couple-income-bonus",
          type: "cashflow" as const,
          kind: "income" as const,
          cadence: "yearly" as const,
          amount: 30000,
          startMonth: baseMonth,
          label: t("scenarios.seeds.eventLabels.bonus"),
          memberId: memberA,
        },
        buildMonthlyCashflow({
          id: "seed-couple-living",
          kind: "expense",
          label: t("scenarios.seeds.eventLabels.living"),
          amount: 14000,
          startMonth: baseMonth,
        }),
        homeEvent,
      ];

      const payload: ScenarioSeedPayload = {
        baseMonth,
        baseCurrency: defaultCurrency,
        initialCash: 200000,
        assumptions: buildSeedAssumptions(baseMonth, {
          inflationRate: 2.5,
          salaryGrowthRate: 3,
          investmentReturnAssumptions: buildInvestmentReturnAssumptions(5),
          propertyAppreciationPct: 2,
          mortgageRatePct: 4,
        }),
        members,
        assets,
        liabilities: [],
        events,
        bundleInstances: [
          buildBundleRecord(homeBundleId, {
            templateId: "life_home_purchase",
            input: homeInput,
          }),
        ],
        bundleSummaries: [
          { id: homeBundleId, title: homeBundleTitle, startMonth: baseMonth },
        ],
      };

      return payload;
    },
  },
  {
    id: "dual-income-rental",
    titleKey: "scenarios.seeds.profiles.dualIncomeRental.title",
    descriptionKey: "scenarios.seeds.profiles.dualIncomeRental.description",
    tagsKey: "scenarios.seeds.profiles.dualIncomeRental.tags",
    keyNumbers: [
      {
        labelKey: "scenarios.seeds.keyNumbers.monthlyIncome",
        metric: "monthlyIncome",
      },
      {
        labelKey: "scenarios.seeds.keyNumbers.rentalIncome",
        metric: "rentalIncome",
      },
      {
        labelKey: "scenarios.seeds.keyNumbers.mortgageBalance",
        metric: "mortgage",
      },
    ],
    buildPayload: (t) => {
      const baseMonth: MonthKey = "2026-02";
      const memberA = "self";
      const memberB = "spouse";
      const memberABirthMonth = offsetMonth(baseMonth, -32 * 12);
      const memberBBirthMonth = offsetMonth(baseMonth, -31 * 12);
      const members = [
        buildMember(
          memberA,
          t("scenarios.seeds.profiles.dualIncomeRental.memberNameA"),
          memberABirthMonth
        ),
        buildMember(
          memberB,
          t("scenarios.seeds.profiles.dualIncomeRental.memberNameB"),
          memberBBirthMonth
        ),
      ];
      const assets = [
        buildAsset({
          id: "seed-rental-cash",
          kind: "cash",
          label: t("scenarios.seeds.assetLabels.cash"),
          currentValue: 300000,
          startMonth: baseMonth,
        }),
      ];

      const homeBundleId = "seed-dual-income-rental";
      const homeBundleTitle = t("scenarios.seeds.bundleLabels.homePurchase");
      const homeInput: HomePurchaseBundleInput = {
        bundleId: homeBundleId,
        label: homeBundleTitle,
        startMonth: baseMonth,
        propertyMarketValue: 7000000,
        mortgageBaseValue: 7000000,
        purchasePrice: 7000000,
        downPaymentMode: "percent",
        downPaymentPercent: 25,
        mortgageRatePct: 3.25,
        mortgageTermYears: 30,
        mortgagePayment: 24000,
        feesOneOff: [
          {
            id: "seed-rental-fee-stamp",
            label: t("scenarios.seeds.eventLabels.stampDuty"),
            amount: 240000,
            month: baseMonth,
          },
        ],
        ongoingCosts: [
          {
            id: "seed-rental-fee-management",
            label: t("scenarios.seeds.eventLabels.managementFee"),
            amount: 1800,
            startMonth: baseMonth,
          },
        ],
        rental: {
          enabled: true,
          rentMonthly: 12000,
          startMonthStrategy: "purchase",
        },
      };
      const homeEvent = buildHomePurchaseBundleEvent(
        homeInput,
        {
          bundleInstanceId: homeBundleId,
          templateId: "life_home_purchase",
          bundleTitle: homeBundleTitle,
        },
        () => "evt_seed_dual_income_rental"
      );

      const events = [
        buildMonthlyCashflow({
          id: "seed-rental-income-a",
          kind: "income",
          label: t("scenarios.seeds.eventLabels.salary"),
          amount: 35000,
          startMonth: baseMonth,
          memberId: memberA,
        }),
        buildMonthlyCashflow({
          id: "seed-rental-income-b",
          kind: "income",
          label: t("scenarios.seeds.eventLabels.salary"),
          amount: 32000,
          startMonth: baseMonth,
          memberId: memberB,
        }),
        buildMonthlyCashflow({
          id: "seed-rental-living",
          kind: "expense",
          label: t("scenarios.seeds.eventLabels.living"),
          amount: 15000,
          startMonth: baseMonth,
        }),
        homeEvent,
      ];

      const payload: ScenarioSeedPayload = {
        baseMonth,
        baseCurrency: defaultCurrency,
        initialCash: 300000,
        assumptions: buildSeedAssumptions(baseMonth, {
          inflationRate: 2.5,
          salaryGrowthRate: 3,
          rentAnnualGrowthPct: 2,
          investmentReturnAssumptions: buildInvestmentReturnAssumptions(5),
          propertyAppreciationPct: 2,
          mortgageRatePct: 4,
        }),
        members,
        assets,
        liabilities: [],
        events,
        bundleInstances: [
          buildBundleRecord(homeBundleId, {
            templateId: "life_home_purchase",
            input: homeInput,
          }),
        ],
        bundleSummaries: [
          { id: homeBundleId, title: homeBundleTitle, startMonth: baseMonth },
        ],
      };

      return payload;
    },
  },
  {
    id: "new-baby",
    titleKey: "scenarios.seeds.profiles.newBaby.title",
    descriptionKey: "scenarios.seeds.profiles.newBaby.description",
    tagsKey: "scenarios.seeds.profiles.newBaby.tags",
    keyNumbers: [
      {
        labelKey: "scenarios.seeds.keyNumbers.monthlyIncome",
        metric: "monthlyIncome",
      },
      {
        labelKey: "scenarios.seeds.keyNumbers.monthlyExpense",
        metric: "monthlyExpense",
      },
      {
        labelKey: "scenarios.seeds.keyNumbers.cash",
        metric: "cash",
      },
    ],
    buildPayload: (t) => {
      const baseMonth: MonthKey = "2026-02";
      const babyMonth = offsetMonth(baseMonth, 5);
      const memberA = "self";
      const memberB = "spouse";
      const memberC = "child1";
      const memberABirthMonth = offsetMonth(baseMonth, -32 * 12);
      const memberBBirthMonth = offsetMonth(baseMonth, -31 * 12);
      const members = [
        buildMember(
          memberA,
          t("scenarios.seeds.profiles.newBaby.memberNameA"),
          memberABirthMonth
        ),
        buildMember(
          memberB,
          t("scenarios.seeds.profiles.newBaby.memberNameB"),
          memberBBirthMonth
        ),
        buildMember(
          memberC,
          t("scenarios.seeds.profiles.newBaby.memberNameC"),
          babyMonth
        ),
      ];
      const assets = [
        buildAsset({
          id: "seed-baby-cash",
          kind: "cash",
          label: t("scenarios.seeds.assetLabels.cash"),
          currentValue: 150000,
          startMonth: baseMonth,
        }),
      ];
      const babyBundleId = "seed-new-baby";
      const babyBundleTitle = t("scenarios.seeds.bundleLabels.newBaby");
      const babyInput: NewBabyPlanInput = {
        birthMonth: babyMonth,
        deliveryCost: 80000,
        childcareMonthly: 5000,
        helperEnabled: false,
        schoolingEnabled: false,
      };
      const babyLabels: NewBabyPlanLabels = {
        deliveryCost: t("scenarios.seeds.bundleLabels.deliveryCost"),
        childcare: t("scenarios.seeds.bundleLabels.childcare"),
        helperMonthly: t("scenarios.seeds.bundleLabels.helperMonthly"),
        agencyFee: t("scenarios.seeds.bundleLabels.agencyFee"),
        schooling: t("scenarios.seeds.bundleLabels.schooling"),
      };
      let babyEventIndex = 0;
      const babyEvents = buildNewBabyBundleEvents(
        babyInput,
        babyLabels,
        {
          bundleInstanceId: babyBundleId,
          templateId: "life_new_baby_plan",
          bundleTitle: babyBundleTitle,
        },
        () => `evt_seed_baby_${babyEventIndex++}`
      );

      const events = [
        buildMonthlyCashflow({
          id: "seed-baby-income-a",
          kind: "income",
          label: t("scenarios.seeds.eventLabels.salary"),
          amount: 30000,
          startMonth: baseMonth,
          memberId: memberA,
        }),
        buildMonthlyCashflow({
          id: "seed-baby-income-b",
          kind: "income",
          label: t("scenarios.seeds.eventLabels.salary"),
          amount: 26000,
          startMonth: baseMonth,
          memberId: memberB,
        }),
        buildMonthlyCashflow({
          id: "seed-baby-living",
          kind: "expense",
          label: t("scenarios.seeds.eventLabels.living"),
          amount: 16000,
          startMonth: baseMonth,
        }),
        buildOneOffExpense({
          id: "seed-baby-setup",
          label: t("scenarios.seeds.eventLabels.babySetup"),
          amount: 15000,
          occurrenceMonth: babyMonth,
        }),
        ...babyEvents,
      ];

      const payload: ScenarioSeedPayload = {
        baseMonth,
        baseCurrency: defaultCurrency,
        initialCash: 150000,
        assumptions: buildSeedAssumptions(baseMonth, {
          inflationRate: 2.5,
          salaryGrowthRate: 3,
        }),
        members,
        assets,
        liabilities: [],
        events,
        bundleInstances: [
          buildBundleRecord(babyBundleId, {
            templateId: "life_new_baby_plan",
            input: babyInput,
          }),
        ],
        bundleSummaries: [
          { id: babyBundleId, title: babyBundleTitle, startMonth: babyMonth },
        ],
      };

      return payload;
    },
  },
  {
    id: "new-baby-helper",
    titleKey: "scenarios.seeds.profiles.newBabyHelper.title",
    descriptionKey: "scenarios.seeds.profiles.newBabyHelper.description",
    tagsKey: "scenarios.seeds.profiles.newBabyHelper.tags",
    keyNumbers: [
      {
        labelKey: "scenarios.seeds.keyNumbers.monthlyIncome",
        metric: "monthlyIncome",
      },
      {
        labelKey: "scenarios.seeds.keyNumbers.monthlyExpense",
        metric: "monthlyExpense",
      },
      {
        labelKey: "scenarios.seeds.keyNumbers.cash",
        metric: "cash",
      },
    ],
    buildPayload: (t) => {
      const baseMonth: MonthKey = "2026-02";
      const babyMonth = offsetMonth(baseMonth, 5);
      const memberA = "self";
      const memberB = "spouse";
      const memberC = "child1";
      const memberD = "helper";
      const memberABirthMonth = offsetMonth(baseMonth, -32 * 12);
      const memberBBirthMonth = offsetMonth(baseMonth, -31 * 12);
      const helperBirthMonth = offsetMonth(baseMonth, -28 * 12);
      const members = [
        buildMember(
          memberA,
          t("scenarios.seeds.profiles.newBabyHelper.memberNameA"),
          memberABirthMonth
        ),
        buildMember(
          memberB,
          t("scenarios.seeds.profiles.newBabyHelper.memberNameB"),
          memberBBirthMonth
        ),
        buildMember(memberC, t("scenarios.seeds.profiles.newBaby.memberNameC"), babyMonth),
        buildMember(memberD, t("eventTypes.helper"), helperBirthMonth),
      ];
      const assets = [
        buildAsset({
          id: "seed-helper-cash",
          kind: "cash",
          label: t("scenarios.seeds.assetLabels.cash"),
          currentValue: 180000,
          startMonth: baseMonth,
        }),
      ];
      const babyBundleId = "seed-new-baby-helper";
      const babyBundleTitle = t("scenarios.seeds.bundleLabels.newBaby");
      const babyInput: NewBabyPlanInput = {
        birthMonth: babyMonth,
        deliveryCost: 90000,
        childcareMonthly: 6000,
        helperEnabled: true,
        helperMonthly: 5000,
        agencyFee: 18000,
        schoolingEnabled: false,
      };
      const babyLabels: NewBabyPlanLabels = {
        deliveryCost: t("scenarios.seeds.bundleLabels.deliveryCost"),
        childcare: t("scenarios.seeds.bundleLabels.childcare"),
        helperMonthly: t("scenarios.seeds.bundleLabels.helperMonthly"),
        agencyFee: t("scenarios.seeds.bundleLabels.agencyFee"),
        schooling: t("scenarios.seeds.bundleLabels.schooling"),
      };
      let babyEventIndex = 0;
      const babyEvents = buildNewBabyBundleEvents(
        babyInput,
        babyLabels,
        {
          bundleInstanceId: babyBundleId,
          templateId: "life_new_baby_plan",
          bundleTitle: babyBundleTitle,
        },
        () => `evt_seed_helper_${babyEventIndex++}`
      );

      const events = [
        buildMonthlyCashflow({
          id: "seed-helper-income-a",
          kind: "income",
          label: t("scenarios.seeds.eventLabels.salary"),
          amount: 32000,
          startMonth: baseMonth,
          memberId: memberA,
        }),
        buildMonthlyCashflow({
          id: "seed-helper-income-b",
          kind: "income",
          label: t("scenarios.seeds.eventLabels.salary"),
          amount: 28000,
          startMonth: baseMonth,
          memberId: memberB,
        }),
        buildMonthlyCashflow({
          id: "seed-helper-living",
          kind: "expense",
          label: t("scenarios.seeds.eventLabels.living"),
          amount: 17000,
          startMonth: baseMonth,
        }),
        ...babyEvents,
      ];

      const payload: ScenarioSeedPayload = {
        baseMonth,
        baseCurrency: defaultCurrency,
        initialCash: 180000,
        assumptions: buildSeedAssumptions(baseMonth, {
          inflationRate: 2.5,
          salaryGrowthRate: 3,
        }),
        members,
        assets,
        liabilities: [],
        events,
        bundleInstances: [
          buildBundleRecord(babyBundleId, {
            templateId: "life_new_baby_plan",
            input: babyInput,
          }),
        ],
        bundleSummaries: [
          { id: babyBundleId, title: babyBundleTitle, startMonth: babyMonth },
        ],
      };

      return payload;
    },
  },
  {
    id: "high-asset",
    titleKey: "scenarios.seeds.profiles.highAsset.title",
    descriptionKey: "scenarios.seeds.profiles.highAsset.description",
    tagsKey: "scenarios.seeds.profiles.highAsset.tags",
    keyNumbers: [
      {
        labelKey: "scenarios.seeds.keyNumbers.monthlyIncome",
        metric: "monthlyIncome",
      },
      {
        labelKey: "scenarios.seeds.keyNumbers.investments",
        metric: "investments",
      },
      {
        labelKey: "scenarios.seeds.keyNumbers.mortgageBalance",
        metric: "mortgage",
      },
    ],
    buildPayload: (t) => {
      const baseMonth: MonthKey = "2026-02";
      const memberA = "self";
      const memberB = "spouse";
      const memberABirthMonth = offsetMonth(baseMonth, -45 * 12);
      const memberBBirthMonth = offsetMonth(baseMonth, -43 * 12);
      const members = [
        buildMember(
          memberA,
          t("scenarios.seeds.profiles.highAsset.memberNameA"),
          memberABirthMonth
        ),
        buildMember(
          memberB,
          t("scenarios.seeds.profiles.highAsset.memberNameB"),
          memberBBirthMonth
        ),
      ];
      const assets = [
        buildAsset({
          id: "seed-wealth-cash",
          kind: "cash",
          label: t("scenarios.seeds.assetLabels.cash"),
          currentValue: 800000,
          startMonth: baseMonth,
        }),
        buildAsset({
          id: "seed-wealth-invest",
          kind: "investment",
          label: t("scenarios.seeds.assetLabels.investments"),
          currentValue: 2000000,
          startMonth: baseMonth,
        }),
      ];
      const homeBundleId = "seed-high-asset-home";
      const homeBundleTitle = t("scenarios.seeds.bundleLabels.homePurchase");
      const homeInput: HomePurchaseBundleInput = {
        bundleId: homeBundleId,
        label: homeBundleTitle,
        startMonth: baseMonth,
        propertyMarketValue: 12000000,
        mortgageBaseValue: 12000000,
        purchasePrice: 12000000,
        downPaymentMode: "amount",
        downPaymentAmount: 5000000,
        mortgageRatePct: 3,
        mortgageTermYears: 25,
        mortgagePayment: 40000,
        feesOneOff: [
          {
            id: "seed-wealth-fee-stamp",
            label: t("scenarios.seeds.eventLabels.stampDuty"),
            amount: 400000,
            month: baseMonth,
          },
        ],
        ongoingCosts: [
          {
            id: "seed-wealth-fee-management",
            label: t("scenarios.seeds.eventLabels.managementFee"),
            amount: 2500,
            startMonth: baseMonth,
          },
        ],
      };
      const homeEvent = buildHomePurchaseBundleEvent(
        homeInput,
        {
          bundleInstanceId: homeBundleId,
          templateId: "life_home_purchase",
          bundleTitle: homeBundleTitle,
        },
        () => "evt_seed_high_asset_home"
      );

      const events = [
        buildMonthlyCashflow({
          id: "seed-wealth-income-a",
          kind: "income",
          label: t("scenarios.seeds.eventLabels.salary"),
          amount: 80000,
          startMonth: baseMonth,
          memberId: memberA,
        }),
        buildMonthlyCashflow({
          id: "seed-wealth-income-b",
          kind: "income",
          label: t("scenarios.seeds.eventLabels.bonus"),
          amount: 50000,
          startMonth: baseMonth,
          memberId: memberB,
        }),
        buildMonthlyCashflow({
          id: "seed-wealth-living",
          kind: "expense",
          label: t("scenarios.seeds.eventLabels.living"),
          amount: 30000,
          startMonth: baseMonth,
        }),
        homeEvent,
      ];

      const payload: ScenarioSeedPayload = {
        baseMonth,
        baseCurrency: defaultCurrency,
        initialCash: 800000,
        assumptions: buildSeedAssumptions(baseMonth, {
          inflationRate: 2.5,
          salaryGrowthRate: 2,
          investmentReturnAssumptions: buildInvestmentReturnAssumptions(6),
          propertyAppreciationPct: 2,
          mortgageRatePct: 4,
        }),
        members,
        assets,
        liabilities: [],
        events,
        bundleInstances: [
          buildBundleRecord(homeBundleId, {
            templateId: "life_home_purchase",
            input: homeInput,
          }),
        ],
        bundleSummaries: [
          { id: homeBundleId, title: homeBundleTitle, startMonth: baseMonth },
        ],
      };

      return payload;
    },
  },
];

export const getScenarioSeeds = (t: ScenarioSeedTranslator): ScenarioSeedCard[] =>
  seedDefinitions.map((seed) => {
    const payload = seed.buildPayload(t);
    const summary = summarizeScenarioSeedPayload(payload);
    return {
      id: seed.id,
      title: t(seed.titleKey),
      description: t(seed.descriptionKey),
      tags: normalizeSeedTags(t.raw(seed.tagsKey)),
      keyNumbers: seed.keyNumbers.map((item) => ({
        label: t(item.labelKey),
        value: Intl.NumberFormat(undefined, {
          style: "currency",
          currency: defaultCurrency,
          maximumFractionDigits: 0,
        }).format(getKeyNumberValue(summary, item.metric)),
      })),
      payload,
      summary,
    };
  });

export { summarizeScenarioSeedPayload };
