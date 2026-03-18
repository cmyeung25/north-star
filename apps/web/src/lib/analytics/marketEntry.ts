export type MarketEntryEventName =
  | "market_landing_view"
  | "journey_cta_click"
  | "auth_modal_open"
  | "preset_create_started"
  | "preset_create_submitted"
  | "onboarding_started";

export type MarketEntryEventPayload = {
  locale: string;
  journeyId: string | null;
  presetId: string | null;
  isSignedIn: boolean;
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

export const trackMarketEntryEvent = (
  name: MarketEntryEventName,
  payload: MarketEntryEventPayload,
) => {
  const event: MarketEntryEvent = {
    name,
    payload,
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

