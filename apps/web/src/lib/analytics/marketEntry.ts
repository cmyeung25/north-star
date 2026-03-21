export type MarketEntryEventName =
  | "market_landing_view"
  | "sample_journey_impression"
  | "journey_cta_click"
  | "auth_modal_open"
  | "case_created"
  | "preset_create_started"
  | "preset_create_submitted"
  | "onboarding_started";

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

export const trackMarketEntryEvent = (
  name: MarketEntryEventName,
  payload: MarketEntryEventPayload,
) => {
  const event: MarketEntryEvent = {
    name,
    payload: sanitizeMarketEntryPayload(payload),
    ts: new Date().toISOString(),
  };

  if (typeof window === "undefined") {
    return;
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
