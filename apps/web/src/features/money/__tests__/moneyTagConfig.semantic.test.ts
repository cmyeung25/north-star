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

  it("keeps non-color signals on all money tags via prefix + icon + order", () => {
    const configEntries = Object.values(moneyTagConfig);

    configEntries.forEach((config) => {
      expect(config.prefix.length > 0).toBe(true);
      expect(config.icon.length > 0).toBe(true);
      expect(Number.isFinite(config.priority)).toBe(true);
    });

    const priorityByKind = Object.fromEntries(
      Object.entries(moneyTagConfig).map(([kind, config]) => [kind, config.priority])
    );

    expect(priorityByKind.incomeType).toBe(priorityByKind.expenseType);
    expect(priorityByKind.incomeType < priorityByKind.cadence).toBe(true);
    expect(priorityByKind.cadence < priorityByKind.member).toBe(true);
    expect(priorityByKind.member < priorityByKind.adjustment).toBe(true);
    expect(priorityByKind.adjustment < priorityByKind.source).toBe(true);
    expect(priorityByKind.source < priorityByKind.attribute).toBe(true);
  });
});
