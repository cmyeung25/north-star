"use client";

import { useSearchParams } from "next/navigation";
import OnboardingWizard from "./OnboardingWizard";
import OnboardingDraftWizard from "./OnboardingDraftWizard";

const normalizeVersion = (value?: string | null) => {
  if (value === "1" || value === "2") {
    return value;
  }
  return null;
};

const resolveDefaultVersion = () => {
  const envVersion = process.env.NEXT_PUBLIC_ONBOARDING_DEFAULT_VERSION;
  return envVersion === "2" ? "2" : "1";
};

export default function OnboardingEntry() {
  const searchParams = useSearchParams();
  const queryVersion = normalizeVersion(searchParams.get("v"));
  const mode = searchParams.get("mode");

  const resolvedVersion =
    queryVersion ?? (mode === "draft" ? "2" : resolveDefaultVersion());

  if (resolvedVersion === "2") {
    return <OnboardingDraftWizard />;
  }

  return <OnboardingWizard />;
}
