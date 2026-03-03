import { describe, expect, it } from "vitest";
import { resolveAssetDisplayLabel } from "../resolveAssetDisplayLabel";

const t = (key: "assetTypeCash" | "assetUntitled") => key;

describe("resolveAssetDisplayLabel", () => {
  it("uses trimmed label when provided", () => {
    expect(
      resolveAssetDisplayLabel({ kind: "investment", label: "  My ETF  " }, t)
    ).toBe("My ETF");
  });

  it("falls back to cash label when kind is cash and label is empty", () => {
    expect(resolveAssetDisplayLabel({ kind: "cash", label: "" }, t)).toBe(
      "assetTypeCash"
    );
  });

  it("falls back to cash label when kind is cash and label is undefined", () => {
    expect(resolveAssetDisplayLabel({ kind: "cash", label: undefined }, t)).toBe(
      "assetTypeCash"
    );
  });

  it("falls back to untitled for non-cash assets without label", () => {
    expect(
      resolveAssetDisplayLabel({ kind: "investment", label: undefined }, t)
    ).toBe("assetUntitled");
  });
});
