import type { Scenario, ScenarioAssumptions } from "../../store/scenarioStore";
import { buildOnboardingAssumptionsDraft } from "../onboarding/v2/assumptions";

export const ONBOARDING_ASSUMPTIONS_AUTO_APPLY_FLAG_PREFIX =
  "ns:onboarding-assumptions-auto-applied:";

export const getOnboardingAssumptionsAutoApplyFlagKey = (scenarioId: string) =>
  `${ONBOARDING_ASSUMPTIONS_AUTO_APPLY_FLAG_PREFIX}${scenarioId}`;

const hasNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const hasInvestmentReturnAssumptions = (
  assumptions: ScenarioAssumptions
): boolean => {
  const values = assumptions.investmentReturnAssumptions;
  if (!values) {
    return false;
  }
  return [values.equity, values.bond, values.fund, values.crypto].some(hasNumber);
};

export const buildOnboardingAssumptionsAutoFillPatch = (
  assumptions: ScenarioAssumptions
): Partial<ScenarioAssumptions> => {
  const draft = buildOnboardingAssumptionsDraft(assumptions);
  const patch: Partial<ScenarioAssumptions> = {};

  if (!hasNumber(assumptions.inflationRate) && hasNumber(draft.inflationPct)) {
    patch.inflationRate = draft.inflationPct;
  }
  if (!hasNumber(assumptions.salaryGrowthRate) && hasNumber(draft.incomeGrowthPct)) {
    patch.salaryGrowthRate = draft.incomeGrowthPct;
  }
  if (
    !hasNumber(assumptions.rentAnnualGrowthPct) &&
    hasNumber(draft.rentGrowthPct)
  ) {
    patch.rentAnnualGrowthPct = draft.rentGrowthPct;
  }
  if (
    !hasNumber(assumptions.propertyAppreciationPct) &&
    hasNumber(draft.propertyAppreciationPct)
  ) {
    patch.propertyAppreciationPct = draft.propertyAppreciationPct;
  }
  if (
    !hasNumber(assumptions.carDepreciationRatePct) &&
    hasNumber(draft.carDepreciationPct)
  ) {
    patch.carDepreciationRatePct = draft.carDepreciationPct;
  }
  if (!hasNumber(assumptions.cashYieldPct) && hasNumber(draft.cashYieldPct)) {
    patch.cashYieldPct = draft.cashYieldPct;
  }
  if (!assumptions.taxInputMode && draft.taxInputMode) {
    patch.taxInputMode = draft.taxInputMode;
  }
  if (
    !hasInvestmentReturnAssumptions(assumptions) &&
    hasNumber(draft.investmentReturnPct)
  ) {
    patch.investmentReturnAssumptions = {
      equity: draft.investmentReturnPct,
      bond: draft.investmentReturnPct,
      fund: draft.investmentReturnPct,
      crypto: draft.investmentReturnPct,
    };
  }

  return patch;
};

export const shouldAutoApplyOnboardingAssumptions = ({
  scenario,
  hasAppliedFlag,
}: {
  scenario?: Scenario;
  hasAppliedFlag: boolean;
}) => {
  if (!scenario || scenario.meta?.onboarded !== true || hasAppliedFlag) {
    return false;
  }
  const patch = buildOnboardingAssumptionsAutoFillPatch(scenario.assumptions);
  return Object.keys(patch).length > 0;
};
