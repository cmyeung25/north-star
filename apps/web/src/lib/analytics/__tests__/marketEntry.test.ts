import { beforeEach, describe, expect, it } from "vitest";
import {
  MARKET_ENTRY_ALLOWED_PAYLOAD_KEYS,
  clearMarketEntryAttributionContext,
  clearMarketEntryEvents,
  readMarketEntryAttributionContext,
  readMarketEntryEvents,
  sanitizeMarketEntryPayload,
  trackMarketEntryEvent,
  trackMarketEntryExposureOnce,
  trackMarketEntryOnboardingCompletedFromContext,
  type MarketEntryEventName,
} from "../marketEntry";

const createStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
};

describe("market entry payload contract", () => {
  beforeEach(() => {
    const storage = createStorage();
    Object.defineProperty(globalThis, "localStorage", {
      value: storage,
      configurable: true,
    });
    clearMarketEntryEvents();
    clearMarketEntryAttributionContext();
    delete (globalThis as { window?: unknown }).window;
  });

  it("keeps the event payload metadata-only", () => {
    expect(MARKET_ENTRY_ALLOWED_PAYLOAD_KEYS).toEqual([
      "locale",
      "journeyId",
      "presetId",
      "isSignedIn",
      "experimentSlotKey",
      "experimentVariant",
    ]);
  });

  it("drops non-contract fields from payloads", () => {
    expect(
      sanitizeMarketEntryPayload({
        locale: "en",
        journeyId: "officeSaver",
        presetId: "single-renter",
        isSignedIn: false,
        experimentSlotKey: "landing.hero.value_prop",
        experimentVariant: "control_v1",
        scenarioId: "scenario-secret",
        monthlyIncomeAmount: 50000,
      }),
    ).toEqual({
      locale: "en",
      journeyId: "officeSaver",
      presetId: "single-renter",
      isSignedIn: false,
      experimentSlotKey: "landing.hero.value_prop",
      experimentVariant: "control_v1",
    });
  });
});

describe("trackMarketEntryEvent", () => {
  beforeEach(() => {
    const storage = createStorage();
    Object.defineProperty(globalThis, "localStorage", {
      value: storage,
      configurable: true,
    });
    clearMarketEntryEvents();
    clearMarketEntryAttributionContext();
  });

  it("supports the full publishability funnel event set", () => {
    const capturedNames: MarketEntryEventName[] = [];
    const tracker = (event: { name: MarketEntryEventName }) => {
      capturedNames.push(event.name);
    };
    (globalThis as { window?: unknown }).window = {
      __NS_MARKET_ENTRY_TRACKER__: tracker,
      localStorage,
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
      "onboarding_completed",
    ];

    eventNames.forEach((eventName) => {
      trackMarketEntryEvent(eventName, {
        locale: "zh-HK",
        journeyId: "coupleHome",
        presetId: "dual-income-home",
        isSignedIn: true,
        experimentSlotKey: "landing.persona.cta_summary",
        experimentVariant: "decision_first_v1",
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
      localStorage,
    };

    trackMarketEntryEvent("case_created", {
      locale: "en",
      journeyId: "newParents",
      presetId: "new-baby",
      isSignedIn: true,
      experimentSlotKey: "landing.sample_journey.summary",
      experimentVariant: "decision_first_v1",
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
        experimentSlotKey: "landing.sample_journey.summary",
        experimentVariant: "decision_first_v1",
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
      localStorage,
    };

    const seenExposureKeys = new Set<string>();
    const payload = {
      locale: "en",
      journeyId: "officeSaver",
      presetId: "single-renter",
      isSignedIn: false,
      experimentSlotKey: "landing.sample_journey.summary",
      experimentVariant: "control_v1",
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

  it("persists events and carries experiment-slot attribution across the create-to-onboarding flow", () => {
    (globalThis as { window?: unknown }).window = { localStorage };

    trackMarketEntryEvent("journey_cta_click", {
      locale: "en",
      journeyId: "officeSaver",
      presetId: "single-renter",
      isSignedIn: false,
      experimentSlotKey: "landing.sample_journey.summary",
      experimentVariant: "clarity_first_v1",
    });
    trackMarketEntryEvent("preset_create_submitted", {
      locale: "en",
      journeyId: "officeSaver",
      presetId: "single-renter",
      isSignedIn: false,
    });
    const trackedCompletion = trackMarketEntryOnboardingCompletedFromContext("en");

    expect(trackedCompletion).toBe(true);
    expect(readMarketEntryAttributionContext()).toBeNull();

    const events = readMarketEntryEvents();
    expect(events).toHaveLength(3);
    expect(events[1]).toMatchObject({
      name: "preset_create_submitted",
      payload: {
        experimentSlotKey: "landing.sample_journey.summary",
        experimentVariant: "clarity_first_v1",
      },
    });
    expect(events[2]).toMatchObject({
      name: "onboarding_completed",
      payload: {
        journeyId: "officeSaver",
        presetId: "single-renter",
        isSignedIn: false,
        experimentSlotKey: "landing.sample_journey.summary",
        experimentVariant: "clarity_first_v1",
      },
    });

    delete (globalThis as { window?: unknown }).window;
  });
});
