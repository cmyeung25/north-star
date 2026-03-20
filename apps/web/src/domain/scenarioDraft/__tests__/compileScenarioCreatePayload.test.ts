import { describe, expect, it } from "vitest";
import { compileScenarioCreatePayload } from "../compileScenarioCreatePayload";
import { validateScenarioDraftV3 } from "../validateScenarioDraftV3";
import type { ScenarioDraftV3 } from "../types";
import type { ScenarioAsset } from "../../../store/scenarioStore";
import type { ScenarioEvent } from "../../scenarioV2/events";

const buildDraft = (): ScenarioDraftV3 => ({
  profile: {
    baseCurrency: "HKD",
    startMonth: "2025-01",
    horizonMonths: 120,
  },
  income: {
    salaryMonthly: 50000,
    salaryGrowthRatePct: 3,
  },
  assumptions: {
    initialCash: 100000,
  },
  assets: [
    {
      id: "asset-home",
      kind: "home",
      label: "Home",
      currency: "HKD",
      startMonth: "2025-01",
      source: "manual",
    },
  ],
  liabilities: [
    {
      id: "liability-mortgage",
      kind: "mortgage",
      principalOutstanding: 2000000,
      annualInterestRatePct: 3.5,
      termYears: 30,
      startMonth: "2025-01",
      source: "manual",
    },
  ],
  meta: {
    onboarded: true,
  },
  clientComputed: {
    onboardingCompleted: true,
  },
});

describe("validateScenarioDraftV3", () => {
  it("validates required fields and mortgage consistency", () => {
    const { issues } = validateScenarioDraftV3({
      profile: { baseCurrency: "", startMonth: "2025-13", horizonMonths: 0 },
      income: { salaryMonthly: -1 },
      liabilities: [{ id: "l1", kind: "mortgage", annualInterestRatePct: 3 }],
    });

    const issueCodes = issues.map((issue) => issue.code);
    expect(issueCodes).toContain("required");
    expect(issueCodes).toContain("invalid-month");
    expect(issueCodes).toContain("invalid-number");
    expect(issueCodes).toContain("inconsistent-mortgage");
  });
});

describe("compileScenarioCreatePayload", () => {
  it("produces consistent structure for onboarding, seed, and plan-lab paths", () => {
    const draft = buildDraft();
    const onboarding = compileScenarioCreatePayload(draft, { nowIso: "2026-01-01T00:00:00.000Z" });
    const seed = compileScenarioCreatePayload(draft, { nowIso: "2026-01-01T00:00:00.000Z" });
    const planLab = compileScenarioCreatePayload(draft, { nowIso: "2026-01-01T00:00:00.000Z" });

    const shape = ({
      assumptions,
      members,
      assets,
      liabilities,
      events,
      meta,
      clientComputed,
      baseCurrency,
    }: ReturnType<typeof compileScenarioCreatePayload>) => ({
      assumptions,
      members,
      assets,
      liabilities,
      events,
      meta,
      clientComputed,
      baseCurrency,
    });

    expect(shape(onboarding)).toEqual(shape(seed));
    expect(shape(onboarding)).toEqual(shape(planLab));
  });

  it("generates rental income event for rental property", () => {
    const draft = buildDraft();
    draft.assets = [
      {
        id: "asset-rental",
        kind: "home",
        currency: "HKD",
        startMonth: "2025-01",
        source: "manual",
        usage: "rent",
        rentMonthly: 22000,
      } as ScenarioAsset & { usage: string; rentMonthly: number },
    ];

    const payload = compileScenarioCreatePayload(draft);
    const rentalIncome = payload.events.find((event) => event.id === "auto:asset-rental:rent-income");
    expect(Boolean(rentalIncome)).toBe(true);
    expect(rentalIncome?.type).toBe("cashflow");
    if (rentalIncome?.type === "cashflow") {
      expect(rentalIncome.kind).toBe("income");
      expect(rentalIncome.amount).toBe(22000);
    }
  });

  it("generates holding-cost expense for owner-occupied property without rental income", () => {
    const draft = buildDraft();
    draft.assets = [
      {
        id: "asset-owner-home",
        kind: "home",
        currency: "HKD",
        startMonth: "2025-01",
        source: "manual",
        usage: "self",
        holdingCostMonthly: 1800,
      } as ScenarioAsset & { usage: string; holdingCostMonthly: number },
    ];

    const payload = compileScenarioCreatePayload(draft);
    const holdingCost = payload.events.find((event) => event.id === "auto:asset-owner-home:holding-cost");

    expect(holdingCost?.type).toBe("cashflow");
    if (holdingCost?.type === "cashflow") {
      expect(holdingCost.kind).toBe("expense");
      expect(holdingCost.amount).toBe(1800);
    }
    expect(payload.events.some((event) => event.id === "auto:asset-owner-home:rent-income")).toBe(false);
  });

  it("treats positive rent on property as rental fallback when usage is omitted", () => {
    const draft = buildDraft();
    draft.assets = [
      {
        id: "asset-rental-fallback",
        kind: "home",
        currency: "HKD",
        startMonth: "2025-01",
        source: "manual",
        rentMonthly: 18500,
      } as ScenarioAsset & { rentMonthly: number },
    ];

    const payload = compileScenarioCreatePayload(draft);
    const rentalIncome = payload.events.find((event) => event.id === "auto:asset-rental-fallback:rent-income");

    expect(rentalIncome?.type).toBe("cashflow");
    if (rentalIncome?.type === "cashflow") {
      expect(rentalIncome.kind).toBe("income");
      expect(rentalIncome.amount).toBe(18500);
    }
  });

  it("generates mortgage liability and payment for property mortgage", () => {
    const draft = buildDraft();
    draft.assets = [
      {
        id: "asset-home-mortgage",
        kind: "home",
        currency: "HKD",
        startMonth: "2025-01",
        source: "manual",
        mortgagePrincipalOutstanding: 3000000,
        mortgageAnnualInterestRatePct: 3.75,
        mortgageTermYears: 30,
      } as ScenarioAsset & {
        mortgagePrincipalOutstanding: number;
        mortgageAnnualInterestRatePct: number;
        mortgageTermYears: number;
      },
    ];

    const payload = compileScenarioCreatePayload(draft);
    expect(payload.liabilities.some((liability) => liability.id === "auto:asset-home-mortgage:mortgage-liability")).toBe(true);
    const paymentEvent = payload.events.find((event) => event.id === "auto:asset-home-mortgage:mortgage-payment");
    expect(Boolean(paymentEvent)).toBe(true);
    expect(paymentEvent?.type).toBe("cashflow");
    if (paymentEvent?.type === "cashflow") {
      expect(paymentEvent.kind).toBe("expense");
      expect(paymentEvent.amount > 0).toBe(true);
    }
  });

  it("does not derive mortgage artifacts when principal outstanding is zero", () => {
    const draft = buildDraft();
    draft.assets = [
      {
        id: "asset-home-no-mortgage",
        kind: "home",
        currency: "HKD",
        startMonth: "2025-01",
        source: "manual",
        usage: "self",
        mortgagePrincipalOutstanding: 0,
        mortgageAnnualInterestRatePct: 3.5,
        mortgageTermYears: 30,
      } as ScenarioAsset & {
        usage: string;
        mortgagePrincipalOutstanding: number;
        mortgageAnnualInterestRatePct: number;
        mortgageTermYears: number;
      },
    ];

    const payload = compileScenarioCreatePayload(draft);

    expect(
      payload.liabilities.some((liability) => liability.id === "auto:asset-home-no-mortgage:mortgage-liability")
    ).toBe(false);
    expect(
      payload.events.some((event) => event.id === "auto:asset-home-no-mortgage:mortgage-payment")
    ).toBe(false);
  });

  it("applies manual override without duplicate synonymous expense", () => {
    const draft = buildDraft();
    draft.assets = [
      {
        id: "asset-home-dedupe",
        kind: "home",
        currency: "HKD",
        startMonth: "2025-01",
        source: "manual",
        mortgagePrincipalOutstanding: 1000000,
        mortgageAnnualInterestRatePct: 3,
        mortgageTermYears: 20,
      } as ScenarioAsset & {
        mortgagePrincipalOutstanding: number;
        mortgageAnnualInterestRatePct: number;
        mortgageTermYears: number;
      },
    ];
    draft.events = [
      {
        id: "manual-mortgage-expense",
        type: "cashflow",
        kind: "expense",
        cadence: "monthly",
        amount: 9000,
        startMonth: "2025-01",
        metadata: {
          originAssetId: "asset-home-dedupe",
          generatedByRule: "property.mortgage.payment.v1",
          editableFields: ["amount", "startMonth"],
        },
      } as ScenarioEvent & {
        metadata: {
          originAssetId: string;
          generatedByRule: string;
          editableFields: string[];
        };
      },
    ];

    const payload = compileScenarioCreatePayload(draft);
    const mortgageEvents = payload.events.filter((event) => event.id === "auto:asset-home-dedupe:mortgage-payment");
    expect(mortgageEvents).toHaveLength(1);
    const manualExists = payload.events.some((event) => event.id === "manual-mortgage-expense");
    expect(manualExists).toBe(false);

    const autoEvent = mortgageEvents[0] as unknown as {
      override?: { amount?: number };
    };
    expect(autoEvent.override?.amount).toBe(9000);
  });
});
