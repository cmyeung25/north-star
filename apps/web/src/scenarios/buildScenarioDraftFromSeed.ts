import type { SubmitScenarioDraftInput } from "../domain/scenarioDraft/submitScenarioDraft";
import type { ScenarioSeedPayload } from "./scenarioSeeds";

export const buildScenarioDraftFromSeed = (
  seedPayload: ScenarioSeedPayload
): SubmitScenarioDraftInput["draft"] => ({
  assumptions: {
    ...seedPayload.assumptions,
    baseMonth: seedPayload.assumptions?.baseMonth ?? seedPayload.baseMonth,
    initialCash: seedPayload.assumptions?.initialCash ?? seedPayload.initialCash,
  },
  members: seedPayload.members,
  assets: seedPayload.assets,
  liabilities: seedPayload.liabilities,
  events: seedPayload.events,
  meta: {
    isSeeded: true,
    skipOnboarding: true,
  },
  clientComputed: {
    onboardingCompleted: true,
  },
  baseCurrency: seedPayload.baseCurrency,
});
