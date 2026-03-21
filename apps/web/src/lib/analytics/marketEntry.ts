import {
  appendStoredAnalyticsEvent,
  clearStoredAnalyticsEvents,
  readStoredAnalyticsEvents,
} from "./eventStorage";

const STORAGE_KEY = "north-star.analytics.market-entry.v1";
const CONTEXT_STORAGE_KEY = "north-star.analytics.market-entry-context.v1";
const EVENT_LIMIT = 500;
const CONTEXT_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export type MarketEntryEventName =
  | "market_landing_view"
  | "sample_journey_impression"
  | "journey_cta_click"
  | "auth_modal_open"
  | "case_created"
  | "preset_create_started"
  | "preset_create_submitted"
  | "onboarding_started"
  | "onboarding_completed";

export const MARKET_ENTRY_ALLOWED_PAYLOAD_KEYS = [
  "locale",
  "journeyId",
  "presetId",
  "isSignedIn",
  "experimentSlotKey",
  "experimentVariant",
] as const;

type MarketEntryAllowedPayloadKey = (typeof MARKET_ENTRY_ALLOWED_PAYLOAD_KEYS)[number];

export type MarketEntryEventPayload = {
  locale: string;
  journeyId: string | null;
  presetId: string | null;
  isSignedIn: boolean;
  experimentSlotKey?: string;
  experimentVariant?: string;
  [key: string]: unknown;
};

export type MarketEntryEvent = {
  name: MarketEntryEventName;
  payload: MarketEntryEventPayload;
  ts: string;
};

type MarketEntryAttributionContext = {
  payload: Pick<MarketEntryEventPayload, MarketEntryAllowedPayloadKey>;
  lastEventName: MarketEntryEventName;
  ts: string;
};

const emitConsoleTelemetry = (event: MarketEntryEvent) => {
  console.info("[market-entry]", event);
};

declare global {
  interface Window {
    __NS_MARKET_ENTRY_TRACKER__?: (event: MarketEntryEvent) => void;
  }
}

export const sanitizeMarketEntryPayload = (
  payload: MarketEntryEventPayload,
): Pick<MarketEntryEventPayload, MarketEntryAllowedPayloadKey> => ({
  locale: payload.locale,
  journeyId: payload.journeyId,
  presetId: payload.presetId,
  isSignedIn: payload.isSignedIn,
  experimentSlotKey: payload.experimentSlotKey,
  experimentVariant: payload.experimentVariant,
});

const readStoredContext = (): MarketEntryAttributionContext | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CONTEXT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<MarketEntryAttributionContext>;
    if (
      !parsed ||
      typeof parsed.ts !== "string" ||
      typeof parsed.lastEventName !== "string" ||
      !parsed.payload ||
      typeof parsed.payload !== "object"
    ) {
      return null;
    }

    const ts = Date.parse(parsed.ts);
    if (!Number.isFinite(ts) || Date.now() - ts > CONTEXT_TTL_MS) {
      window.localStorage.removeItem(CONTEXT_STORAGE_KEY);
      return null;
    }

    return {
      payload: sanitizeMarketEntryPayload(parsed.payload as MarketEntryEventPayload),
      lastEventName: parsed.lastEventName as MarketEntryEventName,
      ts: parsed.ts,
    };
  } catch {
    return null;
  }
};

const persistStoredContext = (context: MarketEntryAttributionContext | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!context) {
    window.localStorage.removeItem(CONTEXT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(context));
};

const canReuseContextForPayload = (
  payload: Pick<MarketEntryEventPayload, MarketEntryAllowedPayloadKey>,
  context: MarketEntryAttributionContext | null,
) => {
  if (!context) {
    return false;
  }

  const sameJourney = payload.journeyId === null || payload.journeyId === context.payload.journeyId;
  const samePreset = payload.presetId === null || payload.presetId === context.payload.presetId;
  return sameJourney && samePreset;
};

const mergePayloadWithStoredContext = (
  payload: Pick<MarketEntryEventPayload, MarketEntryAllowedPayloadKey>,
  context: MarketEntryAttributionContext | null,
): Pick<MarketEntryEventPayload, MarketEntryAllowedPayloadKey> => {
  if (!canReuseContextForPayload(payload, context)) {
    return payload;
  }

  return {
    ...payload,
    experimentSlotKey: payload.experimentSlotKey ?? context?.payload.experimentSlotKey,
    experimentVariant: payload.experimentVariant ?? context?.payload.experimentVariant,
  };
};

const shouldPersistAttributionContext = (
  name: MarketEntryEventName,
  payload: Pick<MarketEntryEventPayload, MarketEntryAllowedPayloadKey>,
) => {
  if (name === "onboarding_completed") {
    return false;
  }

  return payload.journeyId !== null || payload.presetId !== null;
};

export const readMarketEntryAttributionContext = () => readStoredContext()?.payload ?? null;

export const clearMarketEntryAttributionContext = () => {
  persistStoredContext(null);
};

export const trackMarketEntryOnboardingCompletedFromContext = (locale: string) => {
  const context = readMarketEntryAttributionContext();
  if (!context || (!context.journeyId && !context.presetId)) {
    return false;
  }

  trackMarketEntryEvent("onboarding_completed", {
    ...context,
    locale,
  });
  return true;
};

export const trackMarketEntryEvent = (
  name: MarketEntryEventName,
  payload: MarketEntryEventPayload,
) => {
  const sanitizedPayload = sanitizeMarketEntryPayload(payload);
  const mergedPayload = mergePayloadWithStoredContext(sanitizedPayload, readStoredContext());
  const event: MarketEntryEvent = {
    name,
    payload: mergedPayload,
    ts: new Date().toISOString(),
  };

  if (typeof window === "undefined") {
    return;
  }

  appendStoredAnalyticsEvent(STORAGE_KEY, event, EVENT_LIMIT);

  if (shouldPersistAttributionContext(name, mergedPayload)) {
    persistStoredContext({
      payload: mergedPayload,
      lastEventName: name,
      ts: event.ts,
    });
  } else if (name === "onboarding_completed") {
    clearMarketEntryAttributionContext();
  }

  const tracker = window.__NS_MARKET_ENTRY_TRACKER__;
  if (typeof tracker === "function") {
    tracker(event);
    return;
  }

  emitConsoleTelemetry(event);
};

export const trackMarketEntryExposureOnce = ({
  seenExposureKeys,
  exposureKey,
  name,
  payload,
}: {
  seenExposureKeys: Set<string>;
  exposureKey: string;
  name: MarketEntryEventName;
  payload: MarketEntryEventPayload;
}) => {
  if (seenExposureKeys.has(exposureKey)) {
    return false;
  }

  seenExposureKeys.add(exposureKey);
  trackMarketEntryEvent(name, payload);
  return true;
};

export const readMarketEntryEvents = () => readStoredAnalyticsEvents<MarketEntryEvent>(STORAGE_KEY);
export const clearMarketEntryEvents = () => clearStoredAnalyticsEvents(STORAGE_KEY);
export const marketEntryStorageKey = STORAGE_KEY;
export const marketEntryContextStorageKey = CONTEXT_STORAGE_KEY;
