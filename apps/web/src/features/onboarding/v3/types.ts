import type { ScenarioAsset, ScenarioMember } from "../../../store/scenarioStore";
import type { ScenarioEventDraft } from "../../../domain/scenarioV2/events";
import type { ScenarioDraftV3 } from "../../../domain/scenarioDraft/types";

type BaseOnboardingAsset = Omit<ScenarioAsset, "kind">;

export type CashAsset = BaseOnboardingAsset & {
  assetType: "cash";
  kind: "cash";
  amount?: number;
};

export type PropertyAsset = BaseOnboardingAsset & {
  assetType: "property";
  kind: "home";
  usage?: "self" | "rent";
  rentMonthly?: number;
  mortgagePrincipalOutstanding?: number;
  mortgageAnnualInterestRatePct?: number;
  mortgageTermYears?: number;
  mortgageTermMonths?: number;
  holdingCostMonthly?: number;
};

export type InvestmentAsset = BaseOnboardingAsset & {
  assetType: "investment";
  kind: "investment";
  principal?: number;
  returnMode?: "assumption" | "custom";
  annualReturnRatePct?: number;
};

export type OnboardingAsset = CashAsset | PropertyAsset | InvestmentAsset;

export type ScenarioDraftV3AssetToggles = {
  propertyEnabled: boolean;
  investmentEnabled: boolean;
};

export type ScenarioDraftV3State = {
  profile: NonNullable<ScenarioDraftV3["profile"]>;
  members: ScenarioMember[];
  assets: OnboardingAsset[];
  assetToggles: ScenarioDraftV3AssetToggles;
  events: ScenarioEventDraft[];
};

export type ScenarioDraftV3LocaleStrings = {
  defaultMemberName: string;
};

const getCurrentYearMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
};

export const createInitialScenarioDraftV3State = (
  localeStrings: ScenarioDraftV3LocaleStrings
): ScenarioDraftV3State => ({
  profile: {
    baseCurrency: "HKD",
    startMonth: getCurrentYearMonth(),
    horizonMonths: 120,
  },
  members: [{ id: "self", name: localeStrings.defaultMemberName, kind: "person" }],
  assets: [],
  assetToggles: {
    propertyEnabled: false,
    investmentEnabled: false,
  },
  events: [],
});
