import type { Metadata } from "next";
import OnboardingEntry from "../../../../../../../../src/features/onboarding/OnboardingEntry";

export const metadata: Metadata = {
  title: "Scenario onboarding",
};

export default function ScenarioOnboardingPage() {
  return <OnboardingEntry />;
}
