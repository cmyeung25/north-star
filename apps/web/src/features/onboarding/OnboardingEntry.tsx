"use client";

import { createElement } from "react";
import { submissionFlags } from "../../lib/featureFlags";
import OnboardingDraftWizard from "./OnboardingDraftWizard";
import OnboardingV3Wizard from "./v3/OnboardingV3Wizard";

export default function OnboardingEntry() {
  if (submissionFlags.onboardingV3Enabled) {
    return createElement(OnboardingV3Wizard);
  }
  return createElement(OnboardingDraftWizard);
}
