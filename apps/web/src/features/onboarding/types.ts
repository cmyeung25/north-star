import type { OnboardingPersona } from "../../store/scenarioStore";

export type OnboardingStepErrors = Record<string, string>;

export const personaLabels: Record<OnboardingPersona, string> = {
  A: "學生 / 初入職",
  B: "追求生活品質",
  C: "建立家庭",
  D: "50–60 準備退休",
  E: "FIRE",
};

export type { OnboardingPersona };
