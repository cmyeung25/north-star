import { createCaseScenarioRepo } from "@north-star/adapters";
import { createSupabaseServerClient } from "../../src/lib/supabase/server";
import { createEmptyScenarioStatePayload } from "./payload";

const DEFAULT_CASE_TITLE = "My Plan";
const DEFAULT_SCENARIO_TITLE = "Baseline";

const repo = () =>
  createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

export async function ensureDefaultCaseAndScenario() {
  const caseRepo = repo();
  const cases = await caseRepo.listCases();

  const ensuredCase =
    cases[0] ??
    (await caseRepo.createCase({
      title: DEFAULT_CASE_TITLE,
      currency: "HKD",
    }));

  const scenarios = await caseRepo.listScenarios(ensuredCase.id);
  const ensuredScenario =
    scenarios[0] ??
    (await caseRepo.createScenario(ensuredCase.id, {
      title: DEFAULT_SCENARIO_TITLE,
      payload: createEmptyScenarioStatePayload(),
    }));

  return {
    caseId: ensuredCase.id,
    scenarioId: ensuredScenario.id,
    revision: ensuredScenario.revision,
  };
}
