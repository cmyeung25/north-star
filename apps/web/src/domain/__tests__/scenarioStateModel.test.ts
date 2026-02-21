import { describe, expect, it } from "vitest";
import { resolveScenarioLifecycle, resolveWorkspaceMode } from "../scenarioStateModel";

describe("resolveScenarioLifecycle", () => {
  it("returns draft before onboarding is completed", () => {
    expect(
      resolveScenarioLifecycle({
        meta: { onboarded: false },
        clientComputed: { onboardingCompleted: false },
      }),
    ).toBe("draft");
  });

  it("returns active after onboarding is completed", () => {
    expect(
      resolveScenarioLifecycle({
        clientComputed: { onboardingCompleted: true },
      }),
    ).toBe("active");
  });

  it("returns active for seeded scenario", () => {
    expect(
      resolveScenarioLifecycle({
        meta: { isSeeded: true },
      }),
    ).toBe("active");
  });

  it("returns active for plan lab saved scenario with skip onboarding", () => {
    expect(
      resolveScenarioLifecycle({
        meta: { skipOnboarding: true },
      }),
    ).toBe("active");
  });
});

describe("resolveWorkspaceMode", () => {
  it("returns core mode for default app routes", () => {
    expect(resolveWorkspaceMode("/app/case/case-1/scenario/scenario-1/dashboard")).toBe("core");
  });

  it("returns plan_lab mode for plan lab route", () => {
    expect(resolveWorkspaceMode("/app/case/case-1/scenario/scenario-1/planlab")).toBe("plan_lab");
  });
});
