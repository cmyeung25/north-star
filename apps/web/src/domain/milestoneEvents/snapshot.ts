import { buildMoneyItems } from "../../../features/moneyFlow/moneyFlowAdapter";
import { toAssetItems } from "../../../features/assets/assetAdapter";
import { toLiabilityItems } from "../../../features/liabilities/liabilityAdapter";
import type { Scenario } from "../../store/scenarioStore";
import type { EventDefinition } from "../events/types";
import type { BudgetRule } from "../../store/scenarioStore";
import type { MilestoneScenarioSnapshot } from "./types";

export const buildMilestoneScenarioSnapshot = (params: {
  scenario: Scenario;
  eventLibrary: EventDefinition[];
  budgetRules: BudgetRule[];
}): MilestoneScenarioSnapshot => {
  const { scenario, eventLibrary, budgetRules } = params;
  return {
    baseCurrency: scenario.baseCurrency,
    moneyItems: buildMoneyItems({ scenario, eventLibrary, budgetRules }),
    assets: toAssetItems(scenario),
    liabilities: toLiabilityItems(scenario),
    budgetRules,
  };
};
