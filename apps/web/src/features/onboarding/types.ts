export type OnboardingStepErrors = Record<string, string>;

export type HouseholdMemberKind = "person" | "pet";

export type OnboardingMemberTemplate = {
  label: string;
  kind: HouseholdMemberKind;
  name: string;
};
