"use server";

import { createCaseScenarioRepo } from "@north-star/adapters";
import { createSupabaseServerClient } from "../../../../../../../../src/lib/supabase/server";
import { serializeScenarioPayloadForSave } from "../../../../../../../../src/persistence/scenarioSavePayloadSerializer";

type ScenarioAssumptionInput = {
  inflationRate: number;
  salaryGrowthRate: number;
  propertyAppreciationPct: number;
};

const repo = () =>
  createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

export async function updateScenarioAssumptionsAction(input: {
  caseId: string;
  scenarioId: string;
  assumptions: ScenarioAssumptionInput;
}) {
  const scenarioRepo = repo();
  const [payload, scenarios] = await Promise.all([
    scenarioRepo.loadScenarioPayload(input.caseId, input.scenarioId),
    scenarioRepo.listScenarios(input.caseId),
  ]);

  const targetScenario = scenarios.find((scenario) => scenario.id === input.scenarioId);
  if (!targetScenario) {
    throw new Error("SCENARIO_NOT_FOUND");
  }

  const nextPayload = {
    ...payload,
    assumptions: {
      ...(((payload as Record<string, unknown>).assumptions as Record<string, unknown> | undefined) ?? {}),
      inflationRate: input.assumptions.inflationRate,
      salaryGrowthRate: input.assumptions.salaryGrowthRate,
      propertyAppreciationPct: input.assumptions.propertyAppreciationPct,
    },
  };

  await scenarioRepo.saveScenarioPayload(
    input.caseId,
    input.scenarioId,
    serializeScenarioPayloadForSave(nextPayload, input.scenarioId),
    targetScenario.revision,
  );
}
