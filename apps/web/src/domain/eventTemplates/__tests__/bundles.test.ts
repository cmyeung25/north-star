import { describe, expect, it } from "vitest";
import { isValidMonthKey } from "../../../utils/monthKey";
import {
  buildHomePurchaseBundleEvent,
  buildNewBabyBundleEvents,
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
});
