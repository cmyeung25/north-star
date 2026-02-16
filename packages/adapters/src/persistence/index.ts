import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaseScenarioRepo } from "./CaseScenarioRepo";
import { LocalCaseScenarioRepo } from "./local/LocalCaseScenarioRepo";
import { SupabaseCaseScenarioRepo } from "./supabase/SupabaseCaseScenarioRepo";

export * from "./CaseScenarioRepo";
export * from "./types";

export const createCaseScenarioRepo = (params: {
  mode: "local" | "cloud";
  supabaseClient?: SupabaseClient;
}): CaseScenarioRepo => {
  if (params.mode === "cloud") {
    if (!params.supabaseClient) {
      throw new Error("Supabase client is required in cloud mode.");
    }
    return new SupabaseCaseScenarioRepo(params.supabaseClient);
  }

  return new LocalCaseScenarioRepo();
};

export * from "./createEmptyScenarioPayload";
