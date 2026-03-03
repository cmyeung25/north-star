import { describe, expect, it } from "vitest";
import { moneyTagConfig } from "../moneyTagConfig";

describe("moneyTagConfig semantic checklist", () => {
  it("uses consistent colors for same semantics across tabs", () => {
    expect(moneyTagConfig.incomeType.semanticColor).toBe("domain-income");
    expect(moneyTagConfig.expenseType.semanticColor).toBe("domain-expense");
    expect(moneyTagConfig.assetType.semanticColor).toBe("domain-asset");
    expect(moneyTagConfig.liabilityType.semanticColor).toBe("domain-liability");
    expect(moneyTagConfig.cadence.semanticColor).toBe("meta-frequency");
    expect(moneyTagConfig.member.semanticColor).toBe("meta-owner");
    expect(moneyTagConfig.adjustment.semanticColor).toBe("meta-adjustment");
  });

  it("does not collapse different domain semantics into one color", () => {
    const domainColors = [
      moneyTagConfig.incomeType.color,
      moneyTagConfig.expenseType.color,
      moneyTagConfig.assetType.color,
      moneyTagConfig.liabilityType.color,
    ];
    expect(new Set(domainColors).size).toBe(domainColors.length);
  });

  it("keeps non-color signals on all money tags", () => {
    Object.values(moneyTagConfig).forEach((config) => {
      expect(Boolean(config.prefix)).toBe(true);
      expect(Boolean(config.icon)).toBe(true);
    });
  });
});
