import type {
  OnboardingV2DraftAssets,
  OnboardingV2DraftDebt,
  OnboardingV2DraftHousing,
  OnboardingV2DraftIncome,
  OnboardingV2DraftInsurance,
  OnboardingV2DraftLivingSpend,
  OnboardingV2DraftMember,
} from "../../domain/onboarding/v2/draftTypes";
import type { OnboardingV2DraftAssumptions } from "../../domain/onboarding/v2/assumptions";
import type { PlanningHorizonYears } from "../../domain/assumptions/planningHorizon";

export const DRAFT_STORAGE_KEY_PREFIX = "onboarding:v2:draft";

export const getDraftStorageKey = (scenarioId?: string) =>
  scenarioId ? `${DRAFT_STORAGE_KEY_PREFIX}:${scenarioId}` : DRAFT_STORAGE_KEY_PREFIX;

export type DraftProfileState = {
  baseCurrency: string;
  startMonth: string;
  horizonYears: PlanningHorizonYears;
};

export type DraftHouseholdState = {
  hasPartner: boolean;
  childCount: number;
  petCount: number;
  members: OnboardingV2DraftMember[];
};

export type DraftStorageState = {
  step: number;
  profile: DraftProfileState;
  household: DraftHouseholdState;
  assumptions: OnboardingV2DraftAssumptions;
  incomes: OnboardingV2DraftIncome[];
  livingSpend: OnboardingV2DraftLivingSpend;
  housing: OnboardingV2DraftHousing;
  assets: OnboardingV2DraftAssets;
  debts: OnboardingV2DraftDebt[];
  insurance: OnboardingV2DraftInsurance;
};
