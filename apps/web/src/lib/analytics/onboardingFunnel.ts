"use client";

import {
  appendStoredAnalyticsEvent,
  clearStoredAnalyticsEvents,
  readStoredAnalyticsEvents,
} from "./eventStorage";
import type {
  OnboardingGuardrailCategory,
  OnboardingGuardrailItem,
  OnboardingGuardrailSection,
  OnboardingGuardrailSeverity,
  OnboardingGuardrailStepId,
} from "../../features/onboarding/v3/guardrails";

export type OnboardingFunnelEventName =
  | "onboarding_review_viewed"
  | "guardrail_shown"
  | "guardrail_fixed"
  | "onboarding_completed";

export type OnboardingReviewSourceContext = "initial_review" | "returned_from_fix";

export type OnboardingFunnelEventPayload = {
  locale: string;
  flowVersion: "onboarding_v3";
  reviewStepId?: "review";
  reviewSessionId?: string;
  reviewSourceContext?: OnboardingReviewSourceContext;
  completenessLevel?: "ready" | "needs_attention" | "incomplete";
  completenessScorePct?: number;
  guardrailLevel?: "clear" | "warning" | "critical";
  guardrailCount?: number;
  criticalGuardrailCount?: number;
  warningGuardrailCount?: number;
  infoGuardrailCount?: number;
  guardrailId?: string;
  guardrailSeverity?: OnboardingGuardrailSeverity;
  guardrailCategory?: OnboardingGuardrailCategory;
  targetStepId?: OnboardingGuardrailStepId;
  targetSection?: OnboardingGuardrailSection;
  [key: string]: unknown;
};

export type OnboardingFunnelEvent = {
  name: OnboardingFunnelEventName;
  payload: OnboardingFunnelEventPayload;
  ts: string;
};

const STORAGE_KEY = "north-star.analytics.onboarding-funnel.v1";
const EVENT_LIMIT = 500;

const emitConsoleTelemetry = (event: OnboardingFunnelEvent) => {
  console.info("[onboarding-funnel]", event);
};

declare global {
  interface Window {
    __NS_ONBOARDING_FUNNEL_TRACKER__?: (event: OnboardingFunnelEvent) => void;
  }
}

export const ONBOARDING_FUNNEL_ALLOWED_PAYLOAD_KEYS = [
  "locale",
  "flowVersion",
  "reviewStepId",
  "reviewSessionId",
  "reviewSourceContext",
  "completenessLevel",
  "completenessScorePct",
  "guardrailLevel",
  "guardrailCount",
  "criticalGuardrailCount",
  "warningGuardrailCount",
  "infoGuardrailCount",
  "guardrailId",
  "guardrailSeverity",
  "guardrailCategory",
  "targetStepId",
  "targetSection",
] as const satisfies ReadonlyArray<keyof OnboardingFunnelEventPayload>;

const ALLOWED_PAYLOAD_KEYS = new Set<keyof OnboardingFunnelEventPayload>(
  ONBOARDING_FUNNEL_ALLOWED_PAYLOAD_KEYS
);

export type PendingGuardrailFix = {
  guardrailId: string;
  guardrailSeverity: OnboardingGuardrailSeverity;
  guardrailCategory: OnboardingGuardrailCategory;
  targetStepId: OnboardingGuardrailStepId;
  targetSection: OnboardingGuardrailSection;
  originReviewSessionId: string;
};

type ResolveCompletedGuardrailFixesInput = {
  pendingFixes: Map<string, PendingGuardrailFix>;
  currentGuardrails: OnboardingGuardrailItem[];
  currentReviewSessionId: string | null;
};

export const createOnboardingReviewSessionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `review_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const buildPendingGuardrailFix = (
  guardrail: OnboardingGuardrailItem,
  reviewSessionId: string
): PendingGuardrailFix => ({
  guardrailId: guardrail.id,
  guardrailSeverity: guardrail.severity,
  guardrailCategory: guardrail.category,
  targetStepId: guardrail.target.stepId,
  targetSection: guardrail.target.section,
  originReviewSessionId: reviewSessionId,
});

export const resolveCompletedGuardrailFixes = ({
  pendingFixes,
  currentGuardrails,
  currentReviewSessionId,
}: ResolveCompletedGuardrailFixesInput) => {
  const remainingPendingFixes = new Map(pendingFixes);

  if (!currentReviewSessionId) {
    return {
      fixedGuardrails: [] as PendingGuardrailFix[],
      remainingPendingFixes,
    };
  }

  const currentGuardrailIds = new Set(currentGuardrails.map((item) => item.id));
  const fixedGuardrails: PendingGuardrailFix[] = [];

  for (const [guardrailId, pendingFix] of pendingFixes.entries()) {
    if (pendingFix.originReviewSessionId === currentReviewSessionId) {
      continue;
    }

    if (currentGuardrailIds.has(guardrailId)) {
      continue;
    }

    fixedGuardrails.push(pendingFix);
    remainingPendingFixes.delete(guardrailId);
  }

  return {
    fixedGuardrails,
    remainingPendingFixes,
  };
};

export const sanitizeOnboardingFunnelPayload = (
  payload: OnboardingFunnelEventPayload
): OnboardingFunnelEventPayload =>
  Object.fromEntries(
    Object.entries(payload).filter(([key]) =>
      ALLOWED_PAYLOAD_KEYS.has(key as keyof OnboardingFunnelEventPayload)
    )
  ) as OnboardingFunnelEventPayload;

export const trackOnboardingFunnelEvent = (
  name: OnboardingFunnelEventName,
  payload: OnboardingFunnelEventPayload
) => {
  if (typeof window === "undefined") {
    return;
  }

  const event: OnboardingFunnelEvent = {
    name,
    payload: sanitizeOnboardingFunnelPayload(payload),
    ts: new Date().toISOString(),
  };

  appendStoredAnalyticsEvent(STORAGE_KEY, event, EVENT_LIMIT);

  const tracker = window.__NS_ONBOARDING_FUNNEL_TRACKER__;
  if (typeof tracker === "function") {
    tracker(event);
    return;
  }

  emitConsoleTelemetry(event);
};


export const readOnboardingFunnelEvents = () =>
  readStoredAnalyticsEvents<OnboardingFunnelEvent>(STORAGE_KEY);
export const clearOnboardingFunnelEvents = () => clearStoredAnalyticsEvents(STORAGE_KEY);
export const onboardingFunnelStorageKey = STORAGE_KEY;
