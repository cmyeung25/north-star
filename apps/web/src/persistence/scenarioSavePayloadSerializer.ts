import { ensureEventSchemaMarker, normalizeScenarioPayloadSchema } from "@north-star/adapters";

const ensureScenarioSaveMeta = (payload: Record<string, unknown>, scenarioId: string) => {
  const next = { ...payload };
  next.events = Array.isArray(next.events) ? next.events : [];
  const now = new Date().toISOString();

  const scenarios = Array.isArray(next.scenarios) ? next.scenarios : [];
  const activeScenarioId = typeof next.activeScenarioId === "string" ? next.activeScenarioId : scenarioId;

  let activeScenarioOnboarded = false;
  let activeScenarioOnboardedAt: string | null = null;

  next.scenarios = scenarios.map((entry) => {
    if (!entry || typeof entry !== "object") {
      return entry;
    }

    const scenarioEntry = entry as Record<string, unknown>;
    const scenarioMeta =
      scenarioEntry.meta && typeof scenarioEntry.meta === "object"
        ? (scenarioEntry.meta as Record<string, unknown>)
        : {};
    const onboarded = scenarioMeta.onboarded === true;
    const onboardedAt = typeof scenarioMeta.onboardedAt === "string" ? scenarioMeta.onboardedAt : null;
    const isActive = scenarioEntry.id === activeScenarioId;

    if (isActive) {
      activeScenarioOnboarded = onboarded;
      activeScenarioOnboardedAt = onboardedAt;
    }

    return {
      ...scenarioEntry,
      events: Array.isArray(scenarioEntry.events) ? scenarioEntry.events : [],
      meta: {
        ...scenarioMeta,
        schemaVersion: 2,
        onboardingVersion: 2,
        lastSavedAt: now,
        onboarded,
        onboardedAt: onboarded ? onboardedAt ?? now : null,
      },
    };
  });

  const meta = next.meta && typeof next.meta === "object" ? (next.meta as Record<string, unknown>) : {};
  const rootOnboarded = meta.onboarded === true || activeScenarioOnboarded;
  const rootOnboardedAt = typeof meta.onboardedAt === "string" ? meta.onboardedAt : activeScenarioOnboardedAt;

  next.meta = {
    ...meta,
    schemaVersion: 2,
    onboardingVersion: 2,
    lastSavedAt: now,
    onboarded: rootOnboarded,
    onboardedAt: rootOnboarded ? rootOnboardedAt ?? now : null,
  };
  next.schemaVersion = 2;
  return next;
};

export const serializeScenarioPayloadForSave = (payload: Record<string, unknown>, scenarioId: string) =>
  normalizeScenarioPayloadSchema(ensureEventSchemaMarker(ensureScenarioSaveMeta(payload, scenarioId)));
