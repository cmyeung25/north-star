"use server";

import { createCaseScenarioRepo } from "@north-star/adapters";
import { createSupabaseServerClient } from "../../../../../../../src/lib/supabase/server";

export async function saveScenarioPayloadAction(
  caseId: string,
  scenarioId: string,
  payload: Record<string, unknown>,
  expectedRevision?: number,
) {
  const repo = createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

  return repo.saveScenarioPayload(caseId, scenarioId, payload, expectedRevision);
}
