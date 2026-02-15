import { describe, expect, it } from "vitest";
import { compileScenarioV2ToLedger } from "../../engine/scenarioV2Compiler";
import { getScenarioSeeds } from "../scenarioSeeds";

const t = Object.assign((key: string) => key, {
  raw: () => [],
});

describe("scenario seed mapping", () => {
  it("summarizes the dual-income home seed totals", () => {
    const seeds = getScenarioSeeds(t);
    const seed = seeds.find((entry) => entry.id === "dual-income-home");

    expect(Boolean(seed)).toBe(true);
    expect(seed?.summary.monthlyIncome).toBe(65000);
    expect(seed?.summary.monthlyExpense).toBe(35500);
    expect(seed?.summary.monthlyNet).toBe(29500);
    expect(seed?.summary.assetsTotal).toBe(6250000);
    expect(seed?.summary.liabilitiesTotal).toBe(4800000);
  });

  it("keeps new-baby bundle one-off summary aligned with generated leaf events", () => {
    const seed = getScenarioSeeds(t).find((entry) => entry.id === "new-baby");
    expect(seed !== undefined).toBe(true);

    const bundleId = seed?.payload.bundleInstances[0]?.id;
    expect(Boolean(bundleId)).toBe(true);

    const bundleEvents = (seed?.payload.events ?? []).filter(
      (event) => event.source?.bundleInstanceId === bundleId
    );

    const oneOffExpenseTotal = bundleEvents.reduce((sum, event) => {
      if (event.type === "cashflow" && event.kind === "expense" && event.cadence === "oneOff") {
        return sum + Math.abs(event.amount);
      }
      return sum;
    }, 0);

    const expectedFromBundleInput =
      seed?.payload.bundleInstances[0]?.wizardInput.templateId === "life_new_baby_plan"
        ? seed.payload.bundleInstances[0].wizardInput.input.deliveryCost ?? 0
        : 0;

    expect(oneOffExpenseTotal).toBe(expectedFromBundleInput);
  });

  it("includes new-baby bundle spend in projection ledger rows", () => {
    const seed = getScenarioSeeds(t).find((entry) => entry.id === "new-baby");
    expect(seed !== undefined).toBe(true);

    const ledgerRows = compileScenarioV2ToLedger({
      id: "seed-test",
      name: "seed-test",
      baseCurrency: seed?.payload.baseCurrency ?? "HKD",
      updatedAt: Date.now(),
      assumptions: seed?.payload.assumptions as never,
      events: (seed?.payload.events ?? []).map((event, index) => ({
        ...event,
        id: event.id ?? `test-event-${index}`,
      })) as never,
      assets: seed?.payload.assets ?? [],
      liabilities: seed?.payload.liabilities ?? [],
      members: seed?.payload.members ?? [],
      meta: { schemaVersion: 2 },
    });

    const bundleId = seed?.payload.bundleInstances[0]?.id;
    const bundleEventIds = new Set(
      (seed?.payload.events ?? [])
        .filter((event) => event.source?.bundleInstanceId === bundleId)
        .map((event) => event.id)
    );

    const bundleLedgerRows = ledgerRows.filter((row) => bundleEventIds.has(row.sourceEventId));

    expect(bundleLedgerRows.length > 0).toBe(true);
    expect(bundleLedgerRows.some((row) => row.amount < 0)).toBe(true);
  });
});
