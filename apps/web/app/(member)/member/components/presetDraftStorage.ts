import type { ScenarioSeedPayload } from "../../../../src/scenarios/scenarioSeeds";
import { getDraftStorageKey } from "../../../../src/features/onboarding/draftStorage";
import { buildOnboardingDraftStateFromSeed } from "../../../../src/features/onboarding/seedPrefill";

export const writePresetDraftToStorage = (
  scenarioId: string,
  payload: ScenarioSeedPayload,
  storage?: Pick<Storage, "setItem">
) => {
  const draftState = buildOnboardingDraftStateFromSeed(payload);
  (storage ?? window.localStorage).setItem(
    getDraftStorageKey(scenarioId),
    JSON.stringify(draftState)
  );
  return draftState;
};
