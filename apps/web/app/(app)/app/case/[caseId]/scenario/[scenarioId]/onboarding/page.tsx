import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OnboardingEntry from "../../../../../../../../src/features/onboarding/OnboardingEntry";

export const metadata: Metadata = {
  title: "Scenario onboarding",
};

type PageProps = {
  params: { caseId?: string; scenarioId?: string };
};

export default function ScenarioOnboardingPage({ params }: PageProps) {
  if (!params.caseId || !params.scenarioId) {
    notFound();
  }

  return <OnboardingEntry />;
}
