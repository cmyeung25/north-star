import { describe, expect, it } from "vitest";

import { createEmptyScenario } from "../src/index";

describe("createEmptyScenario", () => {
  it("returns a scenario with default metadata", () => {
    const scenario = createEmptyScenario();

    expect(scenario.name).toBe("Untitled scenario");
    expect(scenario.events).toHaveLength(0);
    expect(scenario.schemaVersion).toBe("1.0.0");
    expect(scenario.engineVersion).toBe("0.1.0");
  });
});
