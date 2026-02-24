"use server";

import { revalidatePath } from "next/cache";
import { createCaseScenarioRepo } from "@north-star/adapters";
import { scenarioAssumptionSchema } from "../../../../../../../../src/domain/scenarioAssumptions";
import { createSupabaseServerClient } from "../../../../../../../../src/lib/supabase/server";

export type ScenarioAssumptionsDto = {
  inflationRate: number;
  salaryGrowthRate: number;
  investmentReturnPct: number;
  rentAnnualGrowthPct: number;
  propertyAppreciationPct: number;
  cashYieldPct: number;
  carDepreciationRatePct: number;
  emergencyFundMonths: number;
};

const repo = () =>
  createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

const ensureNumeric = (value: unknown, field: string) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a valid number.`);
  }

  return value;
};

const toObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

export async function updateScenarioAssumptionsAction(input: {
  caseId: string;
  scenarioId: string;
  assumptions: ScenarioAssumptionsDto;
}) {
  const inflationRate = ensureNumeric(input.assumptions.inflationRate, "inflationRate");
  const salaryGrowthRate = ensureNumeric(input.assumptions.salaryGrowthRate, "salaryGrowthRate");
  const investmentReturnPct = ensureNumeric(input.assumptions.investmentReturnPct, "investmentReturnPct");
  const rentAnnualGrowthPct = ensureNumeric(input.assumptions.rentAnnualGrowthPct, "rentAnnualGrowthPct");
  const propertyAppreciationPct = ensureNumeric(
    input.assumptions.propertyAppreciationPct,
    "propertyAppreciationPct",
  );
  const cashYieldPct = ensureNumeric(input.assumptions.cashYieldPct, "cashYieldPct");
  const carDepreciationRatePct = ensureNumeric(input.assumptions.carDepreciationRatePct, "carDepreciationRatePct");
  const emergencyFundMonths = ensureNumeric(input.assumptions.emergencyFundMonths, "emergencyFundMonths");

  const parsedAssumptions = scenarioAssumptionSchema.safeParse({
    inflationRate,
    salaryGrowthRate,
    rentAnnualGrowthPct,
    propertyAppreciationPct,
    cashYieldPct,
    carDepreciationRatePct,
    emergencyFundMonths,
  });

  if (!parsedAssumptions.success) {
    throw new Error(parsedAssumptions.error.issues[0]?.message ?? "validation.assumptionGrowthMax");
  }

  const scenarioRepo = repo();
  const scenariosInCase = await scenarioRepo.listScenarios(input.caseId);
  if (!scenariosInCase.some((scenario) => scenario.id === input.scenarioId)) {
    throw new Error("Scenario does not belong to the selected case.");
  }

  const payload = (await scenarioRepo.loadScenarioPayload(input.caseId, input.scenarioId)) as Record<string, unknown>;
  const scenarios = Array.isArray(payload.scenarios) ? payload.scenarios : [];

  const nextScenarios = scenarios.map((entry) => {
    const scenario = toObject(entry);
    if (!scenario || scenario.id !== input.scenarioId) {
      return entry;
    }

    const assumptions = toObject(scenario.assumptions) ?? {};

    return {
      ...scenario,
      assumptions: {
        ...assumptions,
        inflationRate,
        salaryGrowthRate,
        rentAnnualGrowthPct,
        propertyAppreciationPct,
        cashYieldPct,
        carDepreciationRatePct,
        emergencyFundMonths,
        investmentReturnAssumptions: {
          equity: investmentReturnPct,
          bond: investmentReturnPct,
          fund: investmentReturnPct,
          crypto: investmentReturnPct,
        },
      },
    };
  });

  if (!nextScenarios.some((entry) => toObject(entry)?.id === input.scenarioId)) {
    throw new Error("Scenario not found.");
  }

  await scenarioRepo.saveScenarioPayload(input.caseId, input.scenarioId, {
    ...payload,
    scenarios: nextScenarios,
  });

  revalidatePath(`/app/case/${input.caseId}/scenario/${input.scenarioId}/scenario-list`);
}
