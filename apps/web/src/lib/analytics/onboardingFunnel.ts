"use client";

export type OnboardingFunnelEventName =
  | "onboarding_review_viewed"
  | "guardrail_shown"
  | "guardrail_fixed"
  | "onboarding_completed";

export type OnboardingFunnelEventPayload = {
  locale: string;
  flowVersion: "onboarding_v3";
  reviewStepId?: "review";
  completenessLevel?: "ready" | "needs_attention" | "incomplete";
  completenessScorePct?: number;
  guardrailLevel?: "clear" | "warning" | "critical";
  guardrailCount?: number;
  criticalGuardrailCount?: number;
  warningGuardrailCount?: number;
  infoGuardrailCount?: number;
  guardrailId?: string;
  guardrailSeverity?: "critical" | "warning" | "info";
  guardrailCategory?:
    | "key_missing"
    | "obvious_conflict"
    | "basic_inconsistency"
    | "potential_double_counting";
  targetStepId?: "household" | "income" | "expense" | "assets";
  targetSection?: "housing" | "property" | "mortgage" | "fixedExpenses";
  [key: string]: unknown;
};

export type OnboardingFunnelEvent = {
  name: OnboardingFunnelEventName;
  payload: OnboardingFunnelEventPayload;
  ts: string;
};

const emitConsoleTelemetry = (event: OnboardingFunnelEvent) => {
  console.info("[onboarding-funnel]", event);
};

declare global {
  interface Window {
    __NS_ONBOARDING_FUNNEL_TRACKER__?: (event: OnboardingFunnelEvent) => void;
  }
}

export const trackOnboardingFunnelEvent = (
  name: OnboardingFunnelEventName,
  payload: OnboardingFunnelEventPayload
) => {
  if (typeof window === "undefined") {
    return;
  }

  const event: OnboardingFunnelEvent = {
    name,
    payload,
    ts: new Date().toISOString(),
  };

  const tracker = window.__NS_ONBOARDING_FUNNEL_TRACKER__;
  if (typeof tracker === "function") {
    tracker(event);
    return;
  }

  emitConsoleTelemetry(event);
};
