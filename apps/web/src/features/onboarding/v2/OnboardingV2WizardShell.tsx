"use client";

import {
  Button,
  Group,
  Modal,
  Progress,
  Stack,
  Stepper,
  Text,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import OnboardingV2ErrorBoundary from "./OnboardingV2ErrorBoundary";

export type OnboardingV2Step = {
  id: string;
  title: string;
  content: ReactNode;
  hasError?: boolean;
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
  const isMobile = useMediaQuery("(max-width: 47.99em)");
  const [stepsOpened, { open: openSteps, close: closeSteps }] = useDisclosure(false);
  const progress = ((clampedStep + 1) / steps.length) * 100;

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
          {isMobile ? (
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text fw={600} size="sm">
                  步驟 {clampedStep + 1}/{steps.length} · {steps[clampedStep]?.title}
                </Text>
                <Button variant="subtle" size="compact-sm" onClick={openSteps}>
                  查看全部步驟
                </Button>
              </Group>
              <Progress value={progress} size="sm" radius="xl" />
              <Modal opened={stepsOpened} onClose={closeSteps} title="全部步驟" centered>
                <Stack gap="xs">
                  {steps.map((step, index) => (
                    <Button
                      key={step.id}
                      variant={index === clampedStep ? "filled" : "light"}
                      justify="flex-start"
                      onClick={() => {
                        onStepChange(index);
                        closeSteps();
                      }}
                    >
                      {index + 1}. {step.title}
                      {step.hasError ? " ⚠" : ""}
                    </Button>
                  ))}
                </Stack>
              </Modal>
            </Stack>
          ) : (
            <Stepper active={clampedStep} onStepClick={onStepChange}>
              {steps.map((step) => (
                <Stepper.Step
                  key={step.id}
                  label={step.title}
                  color={step.hasError ? "red" : undefined}
                />
              ))}
            </Stepper>
          )}
        </div>
        {activeContent}
        <Group justify="space-between">{navigation}</Group>
      </Stack>
    </OnboardingV2ErrorBoundary>
  );
}
