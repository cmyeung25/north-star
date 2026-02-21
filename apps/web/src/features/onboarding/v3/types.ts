import type { ScenarioAsset, ScenarioMember } from "../../../store/scenarioStore";
import type { ScenarioEventDraft } from "../../../domain/scenarioV2/events";
import type { ScenarioDraftV3 } from "../../../domain/scenarioDraft/types";

export type PropertyAsset = ScenarioAsset & {
  usage?: "self" | "rent";
  rentMonthly?: number;
  mortgagePrincipalOutstanding?: number;
  mortgageAnnualInterestRatePct?: number;
  mortgageTermYears?: number;
  holdingCostMonthly?: number;
};

export type ScenarioDraftV3State = {
  profile: NonNullable<ScenarioDraftV3["profile"]>;
  members: ScenarioMember[];
  assets: PropertyAsset[];
  events: ScenarioEventDraft[];
};

export type ScenarioDraftV3LocaleStrings = {
  defaultMemberName: string;
};

export const createInitialScenarioDraftV3State = (
  localeStrings: ScenarioDraftV3LocaleStrings
): ScenarioDraftV3State => ({
  profile: {
    baseCurrency: "HKD",
    startMonth: "2025-01",
    horizonMonths: 360,
  },
  members: [{ id: "self", name: localeStrings.defaultMemberName, kind: "person" }],
  assets: [],
  events: [],
});
