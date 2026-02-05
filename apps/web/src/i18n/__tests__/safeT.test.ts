import { describe, expect, it } from "vitest";
import { safeT } from "../safeT";

describe("safeT", () => {
  it("returns fallback when translation echoes key", () => {
    const t = (key: string) => key;
    expect(safeT(t, "healthSummaryTitle", "財務健康總覽")).toBe("財務健康總覽");
  });

  it("returns translated value when present", () => {
    const t = () => "財務健康總覽";
    expect(safeT(t, "overview.dashboard.healthSummary.title", "fallback")).toBe("財務健康總覽");
  });
});
