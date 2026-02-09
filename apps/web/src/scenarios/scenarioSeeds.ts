import type { MonthKey } from "../domain/scenarioV2/events";
import type { ScenarioAssumptions } from "../store/scenarioStore";

export type ScenarioSeedTranslator = ((
  key: string,
  values?: Record<string, string | number>
) => string) & { raw: (key: string) => unknown };

export type ScenarioSeedEnvironmentPreset = {
  locale: "HK";
  currency: "HKD";
  baseMonth: MonthKey;
  horizonYears: number;
};

export type ScenarioSeedAssumptionsPreset = Partial<ScenarioAssumptions> & {
  baseMonth?: MonthKey;
  horizonYears?: number;
};

export type ScenarioSeedMemberPreset = {
  roleKey: "self" | "spouse" | "child1" | "helper";
  name: string;
  birthMonthOffsetMonths?: number;
  birthMonth?: MonthKey;
  retireAge?: number;
};

export type ScenarioSeedDefinition = {
  seedKey: string;
  titleKey: string;
  subtitleKey: string;
  tagsKey: string;
  environmentPreset: ScenarioSeedEnvironmentPreset;
  assumptionsPreset: ScenarioSeedAssumptionsPreset;
  membersPreset: ScenarioSeedMemberPreset[];
};

export type ScenarioSeedCard = {
  seedKey: string;
  title: string;
  subtitle: string;
  tags: string[];
  environmentPreset: ScenarioSeedEnvironmentPreset;
  assumptionsPreset: ScenarioSeedAssumptionsPreset;
  membersPreset: ScenarioSeedMemberPreset[];
};

const baseEnvironment: ScenarioSeedEnvironmentPreset = {
  locale: "HK",
  currency: "HKD",
  baseMonth: "2026-02",
  horizonYears: 10,
};

const seedDefinitions: ScenarioSeedDefinition[] = [
  {
    seedKey: "single_renter_saver",
    titleKey: "seeds.profiles.singleRenterSaver.title",
    subtitleKey: "seeds.profiles.singleRenterSaver.subtitle",
    tagsKey: "seeds.profiles.singleRenterSaver.tags",
    environmentPreset: baseEnvironment,
    assumptionsPreset: {
      inflationRate: 2.5,
      salaryGrowthRate: 3,
      investmentReturnAssumptions: { fund: 5 },
      rentAnnualGrowthPct: 2,
      propertyAppreciationPct: 2,
      mortgageRatePct: 4,
    },
    membersPreset: [
      {
        roleKey: "self",
        name: "Self",
        birthMonthOffsetMonths: -30 * 12,
        retireAge: 65,
      },
    ],
  },
  {
    seedKey: "couple_home_purchase",
    titleKey: "seeds.profiles.coupleHomePurchase.title",
    subtitleKey: "seeds.profiles.coupleHomePurchase.subtitle",
    tagsKey: "seeds.profiles.coupleHomePurchase.tags",
    environmentPreset: baseEnvironment,
    assumptionsPreset: {
      inflationRate: 2.5,
      salaryGrowthRate: 3,
      investmentReturnAssumptions: { fund: 5 },
      propertyAppreciationPct: 2,
      mortgageRatePct: 4,
    },
    membersPreset: [
      {
        roleKey: "self",
        name: "Self",
        birthMonthOffsetMonths: -32 * 12,
        retireAge: 65,
      },
      {
        roleKey: "spouse",
        name: "Spouse",
        birthMonthOffsetMonths: -31 * 12,
        retireAge: 65,
      },
    ],
  },
  {
    seedKey: "couple_home_with_rent",
    titleKey: "seeds.profiles.coupleHomeWithRent.title",
    subtitleKey: "seeds.profiles.coupleHomeWithRent.subtitle",
    tagsKey: "seeds.profiles.coupleHomeWithRent.tags",
    environmentPreset: baseEnvironment,
    assumptionsPreset: {
      inflationRate: 2.5,
      salaryGrowthRate: 3,
      investmentReturnAssumptions: { fund: 5 },
      propertyAppreciationPct: 2,
      mortgageRatePct: 4,
      rentAnnualGrowthPct: 2,
    },
    membersPreset: [
      {
        roleKey: "self",
        name: "Self",
        birthMonthOffsetMonths: -32 * 12,
        retireAge: 65,
      },
      {
        roleKey: "spouse",
        name: "Spouse",
        birthMonthOffsetMonths: -31 * 12,
        retireAge: 65,
      },
    ],
  },
  {
    seedKey: "newbaby_basic",
    titleKey: "seeds.profiles.newBabyBasic.title",
    subtitleKey: "seeds.profiles.newBabyBasic.subtitle",
    tagsKey: "seeds.profiles.newBabyBasic.tags",
    environmentPreset: baseEnvironment,
    assumptionsPreset: {
      inflationRate: 2.5,
      salaryGrowthRate: 3,
    },
    membersPreset: [
      {
        roleKey: "self",
        name: "Self",
        birthMonthOffsetMonths: -32 * 12,
        retireAge: 65,
      },
      {
        roleKey: "spouse",
        name: "Spouse",
        birthMonthOffsetMonths: -31 * 12,
        retireAge: 65,
      },
      {
        roleKey: "child1",
        name: "Child",
        birthMonthOffsetMonths: 5,
      },
    ],
  },
  {
    seedKey: "newbaby_with_helper",
    titleKey: "seeds.profiles.newBabyWithHelper.title",
    subtitleKey: "seeds.profiles.newBabyWithHelper.subtitle",
    tagsKey: "seeds.profiles.newBabyWithHelper.tags",
    environmentPreset: baseEnvironment,
    assumptionsPreset: {
      inflationRate: 2.5,
      salaryGrowthRate: 3,
    },
    membersPreset: [
      {
        roleKey: "self",
        name: "Self",
        birthMonthOffsetMonths: -32 * 12,
        retireAge: 65,
      },
      {
        roleKey: "spouse",
        name: "Spouse",
        birthMonthOffsetMonths: -31 * 12,
        retireAge: 65,
      },
      {
        roleKey: "child1",
        name: "Child",
        birthMonthOffsetMonths: 5,
      },
      {
        roleKey: "helper",
        name: "Helper",
        birthMonthOffsetMonths: -28 * 12,
      },
    ],
  },
  {
    seedKey: "high_networth_mix",
    titleKey: "seeds.profiles.highNetworthMix.title",
    subtitleKey: "seeds.profiles.highNetworthMix.subtitle",
    tagsKey: "seeds.profiles.highNetworthMix.tags",
    environmentPreset: baseEnvironment,
    assumptionsPreset: {
      inflationRate: 2.5,
      salaryGrowthRate: 2,
      investmentReturnAssumptions: { fund: 6 },
      propertyAppreciationPct: 2,
      mortgageRatePct: 4,
    },
    membersPreset: [
      {
        roleKey: "self",
        name: "Self",
        birthMonthOffsetMonths: -45 * 12,
        retireAge: 65,
      },
      {
        roleKey: "spouse",
        name: "Spouse",
        birthMonthOffsetMonths: -43 * 12,
        retireAge: 65,
      },
    ],
  },
];

export const getScenarioSeedDefinitions = () => seedDefinitions;

export const getScenarioSeedDefinition = (seedKey: string) =>
  seedDefinitions.find((seed) => seed.seedKey === seedKey) ?? null;

export const getScenarioSeeds = (t: ScenarioSeedTranslator): ScenarioSeedCard[] =>
  seedDefinitions.map((seed) => ({
    seedKey: seed.seedKey,
    title: t(seed.titleKey),
    subtitle: t(seed.subtitleKey),
    tags: (t.raw(seed.tagsKey) as string[]) ?? [],
    environmentPreset: seed.environmentPreset,
    assumptionsPreset: seed.assumptionsPreset,
    membersPreset: seed.membersPreset,
  }));
