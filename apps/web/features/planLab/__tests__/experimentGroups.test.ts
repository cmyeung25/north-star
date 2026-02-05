import { describe, expect, it } from "vitest";
import {
  createSingleItemExperimentGroup,
  resolveExperimentGroupTitle,
  resolveSingleItemExperimentTitle,
} from "../experimentGroups";

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


describe("single item experiment helpers", () => {
  it("builds fallback single-item title when label is empty", () => {
    expect(resolveSingleItemExperimentTitle(" ")).toBe("實驗：單一項目");
  });

  it("creates an enabled experiment group containing the target item", () => {
    const group = createSingleItemExperimentGroup({
      experimentId: "exp_group_1",
      itemId: "events:evt_1",
      itemLabel: "Living expenses",
      createdAt: 123,
    });

    expect(group).toEqual({
      experimentId: "exp_group_1",
      title: "實驗：Living expenses",
      isEnabled: true,
      itemIds: ["events:evt_1"],
      createdAt: 123,
    });
  });
});
