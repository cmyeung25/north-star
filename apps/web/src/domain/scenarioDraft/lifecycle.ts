import type {
  ScenarioClientComputed,
  ScenarioMeta,
} from "../../store/scenarioStore";

export type ScenarioLifecycleSource = "onboarding" | "seed" | "plan-lab";

export const CURRENT_ONBOARDING_VERSION = 2;

type DeriveLifecycleInput = {
  source: ScenarioLifecycleSource;
  meta?: Partial<ScenarioMeta>;
  clientComputed?: Partial<ScenarioClientComputed>;
  nowIso?: string;
};

type DeriveLifecycleResult = {
  meta: Partial<ScenarioMeta>;
  clientComputed: Partial<ScenarioClientComputed>;
};

export const deriveScenarioLifecycleState = ({
  source,
  meta,
  clientComputed,
  nowIso,
}: DeriveLifecycleInput): DeriveLifecycleResult => {
  const nextMeta: Partial<ScenarioMeta> = { ...(meta ?? {}) };
  const nextClientComputed: Partial<ScenarioClientComputed> = {
    ...(clientComputed ?? {}),
  };

  if (source === "onboarding") {
    nextMeta.onboarded = true;
    if (nowIso) {
      nextMeta.onboardedAt = nowIso;
    }
    nextClientComputed.onboardingCompleted = true;
  }

  if (source === "seed") {
    nextMeta.isSeeded = true;
    nextMeta.skipOnboarding = true;
    nextClientComputed.onboardingCompleted = true;
  }

  const isOnboardingCompleted =
    nextMeta.onboarded === true ||
    nextMeta.skipOnboarding === true ||
    nextMeta.isSeeded === true ||
    nextClientComputed.onboardingCompleted === true ||
    Boolean(nextMeta.onboardedAt);

  if (isOnboardingCompleted) {
    nextMeta.onboardingVersion = CURRENT_ONBOARDING_VERSION;
  }

  return {
    meta: nextMeta,
    clientComputed: nextClientComputed,
  };
};
