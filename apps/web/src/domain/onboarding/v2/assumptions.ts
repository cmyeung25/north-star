import type { ScenarioAssumptions, InvestmentAssetClass } from "../../../store/scenarioStore";

export type OnboardingV2TaxInputMode = "gross" | "net";

export type OnboardingV2DraftAssumptions = {
  inflationPct: number | null;
  incomeGrowthPct: number | null;
  investmentReturnPct: number | null;
  rentGrowthPct: number | null;
  propertyAppreciationPct: number | null;
  carDepreciationPct: number | null;
  cashYieldPct: number | null;
  taxInputMode: OnboardingV2TaxInputMode | null;
};

const DEFAULT_INFLATION_RATE = 2;
const DEFAULT_SALARY_GROWTH_RATE = 3;
const DEFAULT_INVESTMENT_RETURN_PCTS: Record<InvestmentAssetClass, number> = {
  equity: 7,
  bond: 3,
  fund: 5,
  crypto: 8,
};
const DEFAULT_CAR_DEPRECIATION_PCT = 0;

const normalizeNumber = (value: unknown): number | null => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeOptionalNumber = (value: unknown): number | null =>
  normalizeNumber(value) ?? null;

const resolveInvestmentReturnPct = (assumptions?: ScenarioAssumptions) => {
  const returns = assumptions?.investmentReturnAssumptions ?? {};
  const values = [
    returns.equity,
    returns.bond,
    returns.fund,
    returns.crypto,
  ].flatMap((value) => (typeof value === "number" ? [value] : []));

  if (values.length === 0) {
    return DEFAULT_INVESTMENT_RETURN_PCTS.fund;
  }

  const unique = new Set(values.map((value) => Number(value.toFixed(4))));
  if (unique.size === 1) {
    return values[0];
  }

  return (
    returns.fund ??
    returns.equity ??
    returns.bond ??
    returns.crypto ??
    DEFAULT_INVESTMENT_RETURN_PCTS.fund
  );
};

export const buildOnboardingAssumptionsDraft = (
  assumptions?: ScenarioAssumptions
): OnboardingV2DraftAssumptions => {
  const inflationPct =
    normalizeNumber(assumptions?.inflationRate) ?? DEFAULT_INFLATION_RATE;
  const incomeGrowthPct =
    normalizeNumber(assumptions?.salaryGrowthRate) ?? DEFAULT_SALARY_GROWTH_RATE;
  const investmentReturnPct =
    normalizeNumber(resolveInvestmentReturnPct(assumptions)) ??
    DEFAULT_INVESTMENT_RETURN_PCTS.fund;

  return {
    inflationPct,
    incomeGrowthPct,
    investmentReturnPct,
    rentGrowthPct: normalizeOptionalNumber(assumptions?.rentAnnualGrowthPct),
    propertyAppreciationPct: normalizeOptionalNumber(
      assumptions?.propertyAppreciationPct
    ),
    carDepreciationPct: normalizeOptionalNumber(
      assumptions?.carDepreciationRatePct
    ),
    cashYieldPct: normalizeOptionalNumber(assumptions?.cashYieldPct),
    taxInputMode: assumptions?.taxInputMode ?? null,
  };
};

export const mergeOnboardingAssumptionsDraft = (
  fallback: OnboardingV2DraftAssumptions,
  override?: Partial<OnboardingV2DraftAssumptions>
): OnboardingV2DraftAssumptions => {
  const inflationPct =
    normalizeNumber(override?.inflationPct) ?? fallback.inflationPct;
  const incomeGrowthPct =
    normalizeNumber(override?.incomeGrowthPct) ?? fallback.incomeGrowthPct;
  const investmentReturnPct =
    normalizeNumber(override?.investmentReturnPct) ??
    fallback.investmentReturnPct;

  return {
    inflationPct,
    incomeGrowthPct,
    investmentReturnPct,
    rentGrowthPct:
      override?.rentGrowthPct === null
        ? null
        : normalizeOptionalNumber(override?.rentGrowthPct) ??
          fallback.rentGrowthPct,
    propertyAppreciationPct:
      override?.propertyAppreciationPct === null
        ? null
        : normalizeOptionalNumber(override?.propertyAppreciationPct) ??
          fallback.propertyAppreciationPct,
    carDepreciationPct:
      override?.carDepreciationPct === null
        ? null
        : normalizeOptionalNumber(override?.carDepreciationPct) ??
          fallback.carDepreciationPct,
    cashYieldPct:
      override?.cashYieldPct === null
        ? null
        : normalizeOptionalNumber(override?.cashYieldPct) ?? fallback.cashYieldPct,
    taxInputMode: override?.taxInputMode ?? fallback.taxInputMode,
  };
};

export const buildAssumptionsPatch = ({
  draft,
  existing,
}: {
  draft: OnboardingV2DraftAssumptions;
  existing?: ScenarioAssumptions;
}): Partial<ScenarioAssumptions> => {
  const inflationRate =
    normalizeNumber(draft.inflationPct) ??
    normalizeNumber(existing?.inflationRate) ??
    DEFAULT_INFLATION_RATE;
  const salaryGrowthRate =
    normalizeNumber(draft.incomeGrowthPct) ??
    normalizeNumber(existing?.salaryGrowthRate) ??
    DEFAULT_SALARY_GROWTH_RATE;
  const investmentReturnPct =
    normalizeNumber(draft.investmentReturnPct) ??
    resolveInvestmentReturnPct(existing);
  const rentAnnualGrowthPct =
    normalizeOptionalNumber(draft.rentGrowthPct) ?? inflationRate;
  const propertyAppreciationPct =
    normalizeOptionalNumber(draft.propertyAppreciationPct) ?? inflationRate;
  const carDepreciationRatePct =
    normalizeOptionalNumber(draft.carDepreciationPct) ??
    DEFAULT_CAR_DEPRECIATION_PCT;

  const patch: Partial<ScenarioAssumptions> = {
    inflationRate,
    salaryGrowthRate,
    rentAnnualGrowthPct,
    investmentReturnAssumptions: {
      equity: investmentReturnPct,
      bond: investmentReturnPct,
      fund: investmentReturnPct,
      crypto: investmentReturnPct,
    },
    propertyAppreciationPct,
    carDepreciationRatePct,
  };

  if (normalizeOptionalNumber(draft.cashYieldPct) !== null) {
    patch.cashYieldPct = normalizeOptionalNumber(draft.cashYieldPct) ?? undefined;
  }

  if (draft.taxInputMode) {
    patch.taxInputMode = draft.taxInputMode;
  }

  return patch;
};
