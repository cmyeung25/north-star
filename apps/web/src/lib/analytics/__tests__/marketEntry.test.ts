import { describe, expect, it } from "vitest";
import {
  MARKET_ENTRY_ALLOWED_PAYLOAD_KEYS,
  sanitizeMarketEntryPayload,
  trackMarketEntryEvent,
  trackMarketEntryExposureOnce,
  type MarketEntryEventName,
} from "../marketEntry";

describe("market entry payload contract", () => {
  it("keeps the event payload metadata-only", () => {
    expect(MARKET_ENTRY_ALLOWED_PAYLOAD_KEYS).toEqual([
      "locale",
      "journeyId",
      "presetId",
      "isSignedIn",
    ]);
  });

  it("drops non-contract fields from payloads", () => {
    expect(
      sanitizeMarketEntryPayload({
        locale: "en",
        journeyId: "officeSaver",
        presetId: "single-renter",
        isSignedIn: false,
        scenarioId: "scenario-secret",
        monthlyIncomeAmount: 50000,
      }),
    ).toEqual({
      locale: "en",
      journeyId: "officeSaver",
      presetId: "single-renter",
      isSignedIn: false,
    });
  });
});

describe("trackMarketEntryEvent", () => {
  it("supports the full publishability funnel event set", () => {
    const capturedNames: MarketEntryEventName[] = [];
    const tracker = (event: { name: MarketEntryEventName }) => {
      capturedNames.push(event.name);
    };
    (globalThis as { window?: unknown }).window = {
      __NS_MARKET_ENTRY_TRACKER__: tracker,
    };

    const eventNames: MarketEntryEventName[] = [
      "market_landing_view",
      "sample_journey_impression",
      "journey_cta_click",
      "auth_modal_open",
      "case_created",
      "preset_create_started",
      "preset_create_submitted",
      "onboarding_started",
    ];

    eventNames.forEach((eventName) => {
      trackMarketEntryEvent(eventName, {
        locale: "zh-HK",
        journeyId: "coupleHome",
        presetId: "dual-income-home",
        isSignedIn: true,
        hiddenAmount: 123456,
      });
    });

    expect(capturedNames).toEqual(eventNames);
    delete (globalThis as { window?: unknown }).window;
  });

  it("sanitizes payloads before invoking the tracker", () => {
    const calls: unknown[] = [];
    (globalThis as { window?: unknown }).window = {
      __NS_MARKET_ENTRY_TRACKER__: (event: unknown) => {
        calls.push(event);
      },
    };

    trackMarketEntryEvent("case_created", {
      locale: "en",
      journeyId: "newParents",
      presetId: "new-baby",
      isSignedIn: true,
      caseId: "case-secret",
      scenarioId: "scenario-secret",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      name: "case_created",
      payload: {
        locale: "en",
        journeyId: "newParents",
        presetId: "new-baby",
        isSignedIn: true,
      },
    });
    expect(calls[0]).not.toMatchObject({
      payload: {
        caseId: "case-secret",
        scenarioId: "scenario-secret",
      },
    });

    delete (globalThis as { window?: unknown }).window;
  });

  it("tracks sample-journey exposures only once per exposure path", () => {
    const calls: unknown[] = [];
    (globalThis as { window?: unknown }).window = {
      __NS_MARKET_ENTRY_TRACKER__: (event: unknown) => {
        calls.push(event);
      },
    };

    const seenExposureKeys = new Set<string>();
    const payload = {
      locale: "en",
      journeyId: "officeSaver",
      presetId: "single-renter",
      isSignedIn: false,
    } as const;

    expect(
      trackMarketEntryExposureOnce({
        seenExposureKeys,
        exposureKey: "officeSaver",
        name: "sample_journey_impression",
        payload,
      }),
    ).toBe(true);
    expect(
      trackMarketEntryExposureOnce({
        seenExposureKeys,
        exposureKey: "officeSaver",
        name: "sample_journey_impression",
        payload,
      }),
    ).toBe(false);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      name: "sample_journey_impression",
      payload,
    });

    delete (globalThis as { window?: unknown }).window;
  });
});
