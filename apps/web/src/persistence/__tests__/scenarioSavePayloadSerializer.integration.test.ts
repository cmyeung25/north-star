import { describe, expect, it } from "vitest";
import { ensureEventSchemaMarker, normalizeScenarioPayloadSchema } from "@north-star/adapters";
import { serializeScenarioPayloadForSave } from "../scenarioSavePayloadSerializer";

describe("scenarioSavePayloadSerializer integration", () => {
  it("keeps payload contract stable across save/reload/duplicate", () => {
    const initial = {
      scenarios: [
        {
          id: "scenario-1",
          name: "Primary",
          meta: { onboarded: true },
        },
      ],
      activeScenarioId: "scenario-1",
      eventLibrary: [],
    } satisfies Record<string, unknown>;

    const saved = serializeScenarioPayloadForSave(initial, "scenario-1") as Record<string, unknown>;
    const reloaded = normalizeScenarioPayloadSchema(ensureEventSchemaMarker(saved)) as Record<string, unknown>;
    const reloadedScenarios = reloaded.scenarios as Array<Record<string, unknown>>;

    const duplicated = serializeScenarioPayloadForSave(
      {
        ...reloaded,
        scenarios: [
          {
            ...reloadedScenarios[0],
            id: "scenario-2",
          },
        ],
        activeScenarioId: "scenario-2",
      },
      "scenario-2",
    ) as Record<string, unknown>;

    expect(saved.schemaVersion).toBe(2);
    expect((saved.meta as Record<string, unknown>).schemaVersion).toBe(2);
    expect(Array.isArray((saved.scenarios as Array<Record<string, unknown>>)[0]?.events)).toBe(true);

    expect(reloaded).toEqual(saved);

    expect(duplicated.schemaVersion).toBe(2);
    expect((duplicated.meta as Record<string, unknown>).schemaVersion).toBe(2);
    expect(typeof (duplicated.meta as Record<string, unknown>).lastSavedAt).toBe("string");
    expect(duplicated.activeScenarioId).toBe("scenario-2");
    expect(((duplicated.scenarios as Array<Record<string, unknown>>)[0]?.meta as Record<string, unknown>).onboardingVersion)
      .toBe(2);
    expect(Array.isArray((duplicated.scenarios as Array<Record<string, unknown>>)[0]?.events)).toBe(true);
  });
});
