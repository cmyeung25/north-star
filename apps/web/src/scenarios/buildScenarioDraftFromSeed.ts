import type { SubmitScenarioDraftInput } from "../domain/scenarioDraft/submitScenarioDraft";
import { deriveScenarioLifecycleState } from "../domain/scenarioDraft/lifecycle";
import type { ScenarioSeedPayload } from "./scenarioSeeds";

export const buildScenarioDraftFromSeed = (
  seedPayload: ScenarioSeedPayload
): SubmitScenarioDraftInput["draft"] => {
  const lifecycle = deriveScenarioLifecycleState({ source: "seed" });

  return {
    assumptions: {
      ...seedPayload.assumptions,
      baseMonth: seedPayload.assumptions?.baseMonth ?? seedPayload.baseMonth,
      initialCash: seedPayload.assumptions?.initialCash ?? seedPayload.initialCash,
    },
    members: seedPayload.members,
    assets: seedPayload.assets,
    liabilities: seedPayload.liabilities,
    events: seedPayload.events,
    meta: lifecycle.meta,
    clientComputed: lifecycle.clientComputed,
    baseCurrency: seedPayload.baseCurrency,
  };
};
