import type { ScenarioDraftSource } from "../domain/scenarioDraft/submitScenarioDraft";

const readFlag = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
};

export const migrationFlags = {
  onboarding: readFlag(process.env.NEXT_PUBLIC_FF_LIFECYCLE_MIGRATION_ONBOARDING, true),
  seed: readFlag(process.env.NEXT_PUBLIC_FF_LIFECYCLE_MIGRATION_SEED, false),
  planLab: readFlag(process.env.NEXT_PUBLIC_FF_LIFECYCLE_MIGRATION_PLAN_LAB, false),
};

export const submissionFlags = {
  onboardingV3Enabled: readFlag(process.env.NEXT_PUBLIC_FF_ONBOARDING_V3_ENABLED, true),
  scenarioDraftCompilerEnabled: readFlag(
    process.env.NEXT_PUBLIC_FF_SCENARIO_DRAFT_COMPILER_ENABLED,
    false
  ),
  planLabSubmissionV2Enabled: readFlag(
    process.env.NEXT_PUBLIC_FF_PLANLAB_SUBMISSION_V2_ENABLED,
    false
  ),
};

export const isMigrationProtectionEnabled = (source: ScenarioDraftSource) => {
  if (source === "onboarding") {
    return migrationFlags.onboarding;
  }
  if (source === "seed") {
    return migrationFlags.seed;
  }
  return migrationFlags.planLab;
};

export const isSubmissionV2Enabled = (source: ScenarioDraftSource) => {
  if (source === "onboarding") {
    return true;
  }
  if (source === "seed") {
    return submissionFlags.scenarioDraftCompilerEnabled;
  }
  return submissionFlags.planLabSubmissionV2Enabled;
};
