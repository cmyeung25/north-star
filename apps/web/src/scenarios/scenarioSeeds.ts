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
  valueKey: string;
};

export type ScenarioSeedSummary = {
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyNet: number;
  assetsTotal: number;
  liabilitiesTotal: number;
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

  payload.assets.forEach((asset) => {
    if (typeof asset.currentValue === "number") {
      assetsTotal += asset.currentValue;
    }
  });

  payload.liabilities.forEach((liability) => {
    if (typeof liability.principalOutstanding === "number") {
      liabilitiesTotal += liability.principalOutstanding;
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
        }
        if (propertyMarketValue > 0) {
          assetsTotal += propertyMarketValue;
          const downPaymentAmount =
            event.downPaymentMode === "amount"
              ? event.downPaymentAmount ?? 0
              : (propertyMarketValue * (event.downPaymentPercent ?? 0)) / 100;
          liabilitiesTotal += Math.max(0, mortgageBaseValue - downPaymentAmount);
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
    bundles: payload.bundleSummaries,
  };
};

const seedDefinitions: ScenarioSeedDefinition[] = [
  {
    id: "single-renter",
    titleKey: "seeds.profiles.singleRenter.title",
    descriptionKey: "seeds.profiles.singleRenter.description",
    tagsKey: "seeds.profiles.singleRenter.tags",
    keyNumbers: [
      {
        labelKey: "seeds.keyNumbers.monthlyIncome",
        valueKey: "seeds.profiles.singleRenter.keyNumbers.monthlyIncome",
      },
      {
        labelKey: "seeds.keyNumbers.monthlyExpense",
        valueKey: "seeds.profiles.singleRenter.keyNumbers.monthlyExpense",
      },
      {
        labelKey: "seeds.keyNumbers.cash",
        valueKey: "seeds.profiles.singleRenter.keyNumbers.cash",
      },
    ],
    buildPayload: (t) => {
      const baseMonth: MonthKey = "2026-02";
      const memberBirthMonth = offsetMonth(baseMonth, -30 * 12);
      const memberId = "self";
      const members = [
        buildMember(
          memberId,
          t("seeds.profiles.singleRenter.memberName"),
          memberBirthMonth
        ),
      ];
      const assets = [
        buildAsset({
          id: "seed-single-cash",
          kind: "cash",
          label: t("seeds.assetLabels.cash"),
          currentValue: 50000,
          startMonth: baseMonth,
        }),
        buildAsset({
          id: "seed-single-invest",
          kind: "investment",
          label: t("seeds.assetLabels.investments"),
          currentValue: 80000,
          startMonth: baseMonth,
        }),
      ];
      const events = [
        buildMonthlyCashflow({
          id: "seed-single-income",
          kind: "income",
          label: t("seeds.eventLabels.salary"),
          amount: 25000,
          startMonth: baseMonth,
          memberId,
        }),
        buildMonthlyCashflow({
          id: "seed-single-rent",
          kind: "expense",
          label: t("seeds.eventLabels.rent"),
          amount: 12000,
          startMonth: baseMonth,
        }),
        buildMonthlyCashflow({
          id: "seed-single-living",
          kind: "expense",
          label: t("seeds.eventLabels.living"),
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
    titleKey: "seeds.profiles.dualIncomeHome.title",
    descriptionKey: "seeds.profiles.dualIncomeHome.description",
    tagsKey: "seeds.profiles.dualIncomeHome.tags",
    keyNumbers: [
      {
        labelKey: "seeds.keyNumbers.monthlyIncome",
        valueKey: "seeds.profiles.dualIncomeHome.keyNumbers.monthlyIncome",
      },
      {
        labelKey: "seeds.keyNumbers.monthlyExpense",
        valueKey: "seeds.profiles.dualIncomeHome.keyNumbers.monthlyExpense",
      },
      {
        labelKey: "seeds.keyNumbers.propertyMortgage",
        valueKey: "seeds.profiles.dualIncomeHome.keyNumbers.propertyMortgage",
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
          t("seeds.profiles.dualIncomeHome.memberNameA"),
          memberABirthMonth
        ),
        buildMember(
          memberB,
          t("seeds.profiles.dualIncomeHome.memberNameB"),
          memberBBirthMonth
        ),
      ];
      const assets = [
        buildAsset({
          id: "seed-couple-cash",
          kind: "cash",
          label: t("seeds.assetLabels.cash"),
          currentValue: 200000,
          startMonth: baseMonth,
        }),
        buildAsset({
          id: "seed-couple-invest",
          kind: "investment",
          label: t("seeds.assetLabels.investments"),
          currentValue: 50000,
          startMonth: baseMonth,
        }),
      ];

      const homeBundleId = "seed-dual-income-home";
      const homeBundleTitle = t("seeds.bundleLabels.homePurchase");
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
            label: t("seeds.eventLabels.stampDuty"),
            amount: 200000,
            month: baseMonth,
          },
          {
            id: "seed-home-fee-legal",
            label: t("seeds.eventLabels.legalFee"),
            amount: 60000,
            month: baseMonth,
          },
        ],
        ongoingCosts: [
          {
            id: "seed-home-fee-management",
            label: t("seeds.eventLabels.managementFee"),
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
          label: t("seeds.eventLabels.salary"),
          amount: 35000,
          startMonth: baseMonth,
          memberId: memberA,
        }),
        buildMonthlyCashflow({
          id: "seed-couple-income-b",
          kind: "income",
          label: t("seeds.eventLabels.salary"),
          amount: 30000,
          startMonth: baseMonth,
          memberId: memberB,
        }),
        buildMonthlyCashflow({
          id: "seed-couple-living",
          kind: "expense",
          label: t("seeds.eventLabels.living"),
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
    titleKey: "seeds.profiles.dualIncomeRental.title",
    descriptionKey: "seeds.profiles.dualIncomeRental.description",
    tagsKey: "seeds.profiles.dualIncomeRental.tags",
    keyNumbers: [
      {
        labelKey: "seeds.keyNumbers.monthlyIncome",
        valueKey: "seeds.profiles.dualIncomeRental.keyNumbers.monthlyIncome",
      },
      {
        labelKey: "seeds.keyNumbers.rentalIncome",
        valueKey: "seeds.profiles.dualIncomeRental.keyNumbers.rentalIncome",
      },
      {
        labelKey: "seeds.keyNumbers.propertyMortgage",
        valueKey: "seeds.profiles.dualIncomeRental.keyNumbers.propertyMortgage",
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
          t("seeds.profiles.dualIncomeRental.memberNameA"),
          memberABirthMonth
        ),
        buildMember(
          memberB,
          t("seeds.profiles.dualIncomeRental.memberNameB"),
          memberBBirthMonth
        ),
      ];
      const assets = [
        buildAsset({
          id: "seed-rental-cash",
          kind: "cash",
          label: t("seeds.assetLabels.cash"),
          currentValue: 300000,
          startMonth: baseMonth,
        }),
      ];

      const homeBundleId = "seed-dual-income-rental";
      const homeBundleTitle = t("seeds.bundleLabels.homePurchase");
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
            label: t("seeds.eventLabels.stampDuty"),
            amount: 240000,
            month: baseMonth,
          },
        ],
        ongoingCosts: [
          {
            id: "seed-rental-fee-management",
            label: t("seeds.eventLabels.managementFee"),
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
          label: t("seeds.eventLabels.salary"),
          amount: 35000,
          startMonth: baseMonth,
          memberId: memberA,
        }),
        buildMonthlyCashflow({
          id: "seed-rental-income-b",
          kind: "income",
          label: t("seeds.eventLabels.salary"),
          amount: 32000,
          startMonth: baseMonth,
          memberId: memberB,
        }),
        buildMonthlyCashflow({
          id: "seed-rental-living",
          kind: "expense",
          label: t("seeds.eventLabels.living"),
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
    titleKey: "seeds.profiles.newBaby.title",
    descriptionKey: "seeds.profiles.newBaby.description",
    tagsKey: "seeds.profiles.newBaby.tags",
    keyNumbers: [
      {
        labelKey: "seeds.keyNumbers.monthlyIncome",
        valueKey: "seeds.profiles.newBaby.keyNumbers.monthlyIncome",
      },
      {
        labelKey: "seeds.keyNumbers.baby",
        valueKey: "seeds.profiles.newBaby.keyNumbers.baby",
      },
      {
        labelKey: "seeds.keyNumbers.cash",
        valueKey: "seeds.profiles.newBaby.keyNumbers.cash",
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
          t("seeds.profiles.newBaby.memberNameA"),
          memberABirthMonth
        ),
        buildMember(
          memberB,
          t("seeds.profiles.newBaby.memberNameB"),
          memberBBirthMonth
        ),
        buildMember(
          memberC,
          t("seeds.profiles.newBaby.memberNameC"),
          babyMonth
        ),
      ];
      const assets = [
        buildAsset({
          id: "seed-baby-cash",
          kind: "cash",
          label: t("seeds.assetLabels.cash"),
          currentValue: 150000,
          startMonth: baseMonth,
        }),
      ];
      const babyBundleId = "seed-new-baby";
      const babyBundleTitle = t("seeds.bundleLabels.newBaby");
      const babyInput: NewBabyPlanInput = {
        birthMonth: babyMonth,
        deliveryCost: 80000,
        childcareMonthly: 5000,
        helperEnabled: false,
        schoolingEnabled: false,
      };
      const babyLabels: NewBabyPlanLabels = {
        deliveryCost: t("seeds.bundleLabels.deliveryCost"),
        childcare: t("seeds.bundleLabels.childcare"),
        helperMonthly: t("seeds.bundleLabels.helperMonthly"),
        agencyFee: t("seeds.bundleLabels.agencyFee"),
        schooling: t("seeds.bundleLabels.schooling"),
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
          label: t("seeds.eventLabels.salary"),
          amount: 30000,
          startMonth: baseMonth,
          memberId: memberA,
        }),
        buildMonthlyCashflow({
          id: "seed-baby-income-b",
          kind: "income",
          label: t("seeds.eventLabels.salary"),
          amount: 26000,
          startMonth: baseMonth,
          memberId: memberB,
        }),
        buildMonthlyCashflow({
          id: "seed-baby-living",
          kind: "expense",
          label: t("seeds.eventLabels.living"),
          amount: 16000,
          startMonth: baseMonth,
        }),
        buildOneOffExpense({
          id: "seed-baby-setup",
          label: t("seeds.eventLabels.babySetup"),
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
    titleKey: "seeds.profiles.newBabyHelper.title",
    descriptionKey: "seeds.profiles.newBabyHelper.description",
    tagsKey: "seeds.profiles.newBabyHelper.tags",
    keyNumbers: [
      {
        labelKey: "seeds.keyNumbers.monthlyIncome",
        valueKey: "seeds.profiles.newBabyHelper.keyNumbers.monthlyIncome",
      },
      {
        labelKey: "seeds.keyNumbers.helper",
        valueKey: "seeds.profiles.newBabyHelper.keyNumbers.helper",
      },
      {
        labelKey: "seeds.keyNumbers.baby",
        valueKey: "seeds.profiles.newBabyHelper.keyNumbers.baby",
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
          t("seeds.profiles.newBabyHelper.memberNameA"),
          memberABirthMonth
        ),
        buildMember(
          memberB,
          t("seeds.profiles.newBabyHelper.memberNameB"),
          memberBBirthMonth
        ),
        buildMember(memberC, t("seeds.profiles.newBaby.memberNameC"), babyMonth),
        buildMember(memberD, t("eventTypes.helper"), helperBirthMonth),
      ];
      const assets = [
        buildAsset({
          id: "seed-helper-cash",
          kind: "cash",
          label: t("seeds.assetLabels.cash"),
          currentValue: 180000,
          startMonth: baseMonth,
        }),
      ];
      const babyBundleId = "seed-new-baby-helper";
      const babyBundleTitle = t("seeds.bundleLabels.newBaby");
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
        deliveryCost: t("seeds.bundleLabels.deliveryCost"),
        childcare: t("seeds.bundleLabels.childcare"),
        helperMonthly: t("seeds.bundleLabels.helperMonthly"),
        agencyFee: t("seeds.bundleLabels.agencyFee"),
        schooling: t("seeds.bundleLabels.schooling"),
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
          label: t("seeds.eventLabels.salary"),
          amount: 32000,
          startMonth: baseMonth,
          memberId: memberA,
        }),
        buildMonthlyCashflow({
          id: "seed-helper-income-b",
          kind: "income",
          label: t("seeds.eventLabels.salary"),
          amount: 28000,
          startMonth: baseMonth,
          memberId: memberB,
        }),
        buildMonthlyCashflow({
          id: "seed-helper-living",
          kind: "expense",
          label: t("seeds.eventLabels.living"),
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
    titleKey: "seeds.profiles.highAsset.title",
    descriptionKey: "seeds.profiles.highAsset.description",
    tagsKey: "seeds.profiles.highAsset.tags",
    keyNumbers: [
      {
        labelKey: "seeds.keyNumbers.monthlyIncome",
        valueKey: "seeds.profiles.highAsset.keyNumbers.monthlyIncome",
      },
      {
        labelKey: "seeds.keyNumbers.investments",
        valueKey: "seeds.profiles.highAsset.keyNumbers.investments",
      },
      {
        labelKey: "seeds.keyNumbers.propertyMortgage",
        valueKey: "seeds.profiles.highAsset.keyNumbers.propertyMortgage",
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
          t("seeds.profiles.highAsset.memberNameA"),
          memberABirthMonth
        ),
        buildMember(
          memberB,
          t("seeds.profiles.highAsset.memberNameB"),
          memberBBirthMonth
        ),
      ];
      const assets = [
        buildAsset({
          id: "seed-wealth-cash",
          kind: "cash",
          label: t("seeds.assetLabels.cash"),
          currentValue: 800000,
          startMonth: baseMonth,
        }),
        buildAsset({
          id: "seed-wealth-invest",
          kind: "investment",
          label: t("seeds.assetLabels.investments"),
          currentValue: 2000000,
          startMonth: baseMonth,
        }),
      ];
      const homeBundleId = "seed-high-asset-home";
      const homeBundleTitle = t("seeds.bundleLabels.homePurchase");
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
            label: t("seeds.eventLabels.stampDuty"),
            amount: 400000,
            month: baseMonth,
          },
        ],
        ongoingCosts: [
          {
            id: "seed-wealth-fee-management",
            label: t("seeds.eventLabels.managementFee"),
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
          label: t("seeds.eventLabels.salary"),
          amount: 80000,
          startMonth: baseMonth,
          memberId: memberA,
        }),
        buildMonthlyCashflow({
          id: "seed-wealth-income-b",
          kind: "income",
          label: t("seeds.eventLabels.bonus"),
          amount: 50000,
          startMonth: baseMonth,
          memberId: memberB,
        }),
        buildMonthlyCashflow({
          id: "seed-wealth-living",
          kind: "expense",
          label: t("seeds.eventLabels.living"),
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
    return {
      id: seed.id,
      title: t(seed.titleKey),
      description: t(seed.descriptionKey),
      tags: (t.raw(seed.tagsKey) as string[]) ?? [],
      keyNumbers: seed.keyNumbers.map((item) => ({
        label: t(item.labelKey),
        value: t(item.valueKey),
      })),
      payload,
      summary: summarizeScenarioSeedPayload(payload),
    };
  });

export { summarizeScenarioSeedPayload };
