import { describe, expect, it } from "vitest";
import { resolveExperimentGroupTitle } from "../experimentGroups";

describe("resolveExperimentGroupTitle", () => {
  it("uses localized fallback for known template ids", () => {
    expect(resolveExperimentGroupTitle("life_home_purchase")).toBe("置業買樓");
    expect(resolveExperimentGroupTitle("life_new_baby")).toBe("新生兒計劃");
  });

  it("falls back to 未命名實驗 when empty", () => {
    expect(resolveExperimentGroupTitle("   ")).toBe("未命名實驗");
    expect(resolveExperimentGroupTitle(undefined)).toBe("未命名實驗");
  });

  it("humanizes internal ids instead of rendering raw ids", () => {
    expect(resolveExperimentGroupTitle("unknown_internal_id")).toBe("Unknown Internal Id");
  });
});
