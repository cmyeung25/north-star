import { describe, expect, it } from "vitest";
import { isValidMonthKey } from "../../../utils/monthKey";
import {
  buildHomePurchaseBundleEvent,
  buildMarriageBundleEvents,
  buildNewBabyBundleEvents,
  buildRentalPlanBundleEvents,
  computeTravelTotal,
  normalizeWeddingBreakdown,
} from "../bundles";

describe("event template bundles", () => {
  it("builds new baby bundle events with toggles", () => {
    let counter = 0;
    const events = buildNewBabyBundleEvents(
      {
        birthMonth: "2026-03",
        deliveryCost: 12000,
        childcareMonthly: 5000,
        helperEnabled: true,
        helperMonthly: 4500,
        agencyFee: 3000,
        schoolingEnabled: true,
        schoolingAmount: 1800,
        schoolingCadence: "yearly",
        schoolingStartMonth: "2027-09",
      },
      {
        deliveryCost: "Delivery cost",
        childcare: "Childcare",
        helperMonthly: "Helper salary",
        agencyFee: "Agency fee",
        schooling: "Schooling",
      },
      {
        bundleInstanceId: "bundle_test",
        templateId: "life_new_baby_plan",
        bundleTitle: "Baby plan",
      },
      () => `evt_test_${counter++}`
    );

    expect(events).toHaveLength(5);
  });

  it("ensures all bundle events include valid MonthKey fields", () => {
    let counter = 0;
    const events = buildNewBabyBundleEvents(
      {
        birthMonth: "2025-12",
        deliveryCost: 10000,
        childcareMonthly: 3000,
        helperEnabled: false,
        schoolingEnabled: true,
        schoolingAmount: 1000,
        schoolingCadence: "monthly",
        schoolingStartMonth: "2026-01",
      },
      {
        deliveryCost: "Delivery cost",
        childcare: "Childcare",
        helperMonthly: "Helper salary",
        agencyFee: "Agency fee",
        schooling: "Schooling",
      },
      {
        bundleInstanceId: "bundle_test",
        templateId: "life_new_baby_plan",
        bundleTitle: "Baby plan",
      },
      () => `evt_test_${counter++}`
    );

    events.forEach((event) => {
      if (event.type !== "cashflow") {
        return;
      }
      if (event.cadence === "oneOff") {
        expect(isValidMonthKey(event.occurrenceMonth ?? "")).toBe(true);
      } else {
        expect(isValidMonthKey(event.startMonth ?? "")).toBe(true);
      }
    });
  });

  it("builds a single mortgage housing event with linked ids", () => {
    const event = buildHomePurchaseBundleEvent(
      {
        eventId: "evt_home",
        label: "Mortgage",
        startMonth: "2025-07",
        purchasePrice: 800000,
        downPaymentMode: "percent",
        downPaymentPercent: 20,
        mortgageRatePct: 4,
        mortgageTermYears: 30,
        mortgagePayment: 3500,
        feesOneOff: [],
        ongoingCosts: [],
        propertyAssetId: "asset_home",
        mortgageLiabilityId: "liability_home",
      },
      {
        bundleInstanceId: "bundle_home",
        templateId: "life_home_purchase",
        bundleTitle: "Home 1",
      }
    );

    expect(event.type).toBe("housing");
    if (event.type !== "housing") {
      throw new Error("Expected housing event.");
    }
    expect(event.kind).toBe("mortgage");
    expect(event.propertyAssetId).toBe("asset_home");
    expect(event.mortgageLiabilityId).toBe("liability_home");
  });

  it("derives rental start month using the start strategy", () => {
    const plusOneEvent = buildHomePurchaseBundleEvent(
      {
        eventId: "evt_home",
        label: "Mortgage",
        startMonth: "2025-07",
        purchasePrice: 800000,
        downPaymentMode: "percent",
        downPaymentPercent: 20,
        mortgageRatePct: 4,
        mortgageTermYears: 30,
        mortgagePayment: 3500,
        rental: {
          enabled: true,
          rentMonthly: 20000,
          startMonthStrategy: "plus1",
        },
      },
      {
        bundleInstanceId: "bundle_home",
        templateId: "life_home_purchase",
        bundleTitle: "Home 1",
      }
    );

    if (plusOneEvent.type !== "housing" || plusOneEvent.kind !== "mortgage") {
      throw new Error("Expected mortgage housing event.");
    }
    expect(plusOneEvent.rental?.startMonth).toBe("2025-08");

    const customEvent = buildHomePurchaseBundleEvent(
      {
        eventId: "evt_home_custom",
        label: "Mortgage",
        startMonth: "2025-07",
        purchasePrice: 800000,
        downPaymentMode: "percent",
        downPaymentPercent: 20,
        mortgageRatePct: 4,
        mortgageTermYears: 30,
        mortgagePayment: 3500,
        rental: {
          enabled: true,
          rentMonthly: 20000,
          startMonth: "2025-10",
        },
      },
      {
        bundleInstanceId: "bundle_home",
        templateId: "life_home_purchase",
        bundleTitle: "Home 1",
      }
    );

    if (customEvent.type !== "housing" || customEvent.kind !== "mortgage") {
      throw new Error("Expected mortgage housing event.");
    }
    expect(customEvent.rental?.startMonth).toBe("2025-10");
  });

  it("builds marriage events with breakdown and travel", () => {
    const breakdown = normalizeWeddingBreakdown(120000, [
      { id: "a", label: "A", amount: 0, ratio: 45 },
      { id: "b", label: "B", amount: 0, ratio: 10 },
      { id: "c", label: "C", amount: 0, ratio: 10 },
      { id: "d", label: "D", amount: 0, ratio: 15 },
      { id: "e", label: "E", amount: 0, ratio: 10 },
      { id: "f", label: "F", amount: 0, ratio: 10 },
    ]);
    const events = buildMarriageBundleEvents(
      {
        title: "Wedding",
        weddingMonth: "2027-01",
        weddingStyle: "small_banquet",
        totalWeddingBudget: 120000,
        breakdownEnabled: true,
        breakdownItems: breakdown,
        includeTravel: true,
        travelMonthMode: "plus1",
        travelBudgetMode: "perPerson",
        travellersCount: 2,
        perPersonBudget: 12000,
      },
      {
        weddingMain: "Wedding",
        travel: "Honeymoon",
      },
      {
        bundleInstanceId: "bundle_marriage",
        templateId: "life_marriage_plan",
      }
    );
    expect(events).toHaveLength(7);
    const travelEvent = events.at(-1);
    if (travelEvent?.type !== "cashflow") {
      throw new Error("Expected cashflow event.");
    }
    expect(travelEvent.occurrenceMonth).toBe("2027-02");
  });



  it("builds destination wedding with optional extra honeymoon", () => {
    const events = buildMarriageBundleEvents(
      {
        title: "Wedding",
        weddingMonth: "2027-01",
        weddingStyle: "destination_wedding",
        totalWeddingBudget: 180000,
        breakdownEnabled: false,
        breakdownItems: [],
        includeTravel: true,
        travelLabel: "Destination wedding travel",
        travelMonthMode: "same",
        travelBudgetMode: "perPerson",
        travellersCount: 2,
        perPersonBudget: 25000,
        extraHoneymoonEnabled: true,
        extraTravelLabel: "Honeymoon travel",
        extraTravelMonthMode: "plus1",
        extraTravelBudgetMode: "total",
        extraTravelTotal: 20000,
      },
      {
        weddingMain: "Wedding",
        travel: "Travel",
      },
      {
        bundleInstanceId: "bundle_marriage",
        templateId: "life_marriage_plan",
      }
    );
    expect(events).toHaveLength(3);
    const destinationEvent = events.find(
      (event) => event.type === "cashflow" && event.label === "Destination wedding travel"
    );
    const honeymoonEvent = events.find(
      (event) => event.type === "cashflow" && event.label === "Honeymoon travel"
    );
    if (!destinationEvent || destinationEvent.type !== "cashflow") {
      throw new Error("Expected destination travel event.");
    }
    if (!honeymoonEvent || honeymoonEvent.type !== "cashflow") {
      throw new Error("Expected honeymoon event.");
    }
    expect(destinationEvent.occurrenceMonth).toBe("2027-01");
    expect(honeymoonEvent.occurrenceMonth).toBe("2027-02");
  });

  it("builds rental bundle events with rent housing and one-off setup costs", () => {
    let counter = 0;
    const events = buildRentalPlanBundleEvents(
      {
        eventId: "evt_rent",
        bundleId: "bundle_rental",
        label: "Kowloon rental",
        startMonth: "2026-05",
        endMonth: "2028-04",
        rentMonthly: 28000,
        rentAnnualGrowthPct: 3,
        depositAmount: 56000,
        agentFeeAmount: 14000,
      },
      {
        deposit: "Rental deposit",
        agentFee: "Agent fee",
      },
      {
        bundleInstanceId: "bundle_rental",
        templateId: "life_rental_plan",
        bundleTitle: "Rental plan",
      },
      () => `evt_rental_${counter++}`
    );

    expect(events).toHaveLength(3);
    const [rentEvent, depositEvent, agentFeeEvent] = events;
    if (rentEvent.type !== "housing" || rentEvent.kind !== "rent") {
      throw new Error("Expected rent housing event.");
    }
    expect(rentEvent.source?.bundleInstanceId).toBe("bundle_rental");
    expect(rentEvent.source?.templateId).toBe("life_rental_plan");
    expect(rentEvent.rentMonthly).toBe(28000);
    expect(rentEvent.rentAnnualGrowthPct).toBe(3);
    if (depositEvent.type !== "cashflow" || agentFeeEvent.type !== "cashflow") {
      throw new Error("Expected one-off cashflow events.");
    }
    expect(depositEvent.occurrenceMonth).toBe("2026-05");
    expect(agentFeeEvent.occurrenceMonth).toBe("2026-05");
    expect(depositEvent.source?.componentKey).toBe("rentalDeposit");
    expect(agentFeeEvent.source?.componentKey).toBe("rentalAgentFee");
  });
  it("computes travel total", () => {
    expect(computeTravelTotal({ mode: "total", total: 30000 })).toBe(30000);
    expect(
      computeTravelTotal({ mode: "perPerson", count: 3, perPerson: 11000 })
    ).toBe(33000);
  });
});
