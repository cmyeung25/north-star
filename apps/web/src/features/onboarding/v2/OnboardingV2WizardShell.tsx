"use client";

import { Group, Stack, Stepper } from "@mantine/core";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import OnboardingV2ErrorBoundary from "./OnboardingV2ErrorBoundary";

export type OnboardingV2Step = {
  id: string;
  title: string;
  content: ReactNode;
};

type OnboardingV2WizardShellProps = {
  steps: OnboardingV2Step[];
  activeStep: number;
  onStepChange: (step: number) => void;
  navigation: ReactNode;
};

export default function OnboardingV2WizardShell({
  steps,
  activeStep,
  onStepChange,
  navigation,
}: OnboardingV2WizardShellProps) {
  const clampedStep = Math.min(Math.max(activeStep, 0), steps.length - 1);
  const activeContent = steps[clampedStep]?.content;
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!headerRef.current) {
      return;
    }
    headerRef.current.focus();
    headerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [clampedStep]);

  return (
    <OnboardingV2ErrorBoundary>
      <Stack gap="lg">
        <div ref={headerRef} tabIndex={-1}>
          <Stepper active={clampedStep} onStepClick={onStepChange}>
            {steps.map((step) => (
              <Stepper.Step key={step.id} label={step.title} />
            ))}
          </Stepper>
        </div>
        {activeContent}
        <Group justify="space-between">{navigation}</Group>
      </Stack>
    </OnboardingV2ErrorBoundary>
  );
}
