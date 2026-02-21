import { describe, expect, it, beforeEach } from "vitest";
import { useUiStore } from "../uiStore";

describe("uiStore workspaceMode", () => {
  beforeEach(() => {
    useUiStore.setState({ workspaceMode: "core" });
  });

  it("defaults to core mode", () => {
    expect(useUiStore.getState().workspaceMode).toBe("core");
  });

  it("updates workspace mode via setter", () => {
    useUiStore.getState().setWorkspaceMode("plan_lab");
    expect(useUiStore.getState().workspaceMode).toBe("plan_lab");

    useUiStore.getState().setWorkspaceMode("core");
    expect(useUiStore.getState().workspaceMode).toBe("core");
  });
});
