import { notFound } from "next/navigation";
import { createCaseScenarioRepo } from "@north-star/adapters";
import { Title } from "@mantine/core";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "../../../../../../../../src/lib/supabase/server";
import ScenarioSettingsClient from "./ScenarioSettingsClient";
import type { ScenarioAssumptionsDto } from "./actions";

type PageProps = {
  params: { caseId: string; scenarioId: string };
};

export default async function ScenarioSettingsPage({ params }: PageProps) {
  const nav = await getTranslations("nav");
  const repo = createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

  const scenarios = await repo.listScenarios(params.caseId);
  if (!scenarios.some((scenario) => scenario.id === params.scenarioId)) {
    notFound();
  }

  const payload = (await repo.loadScenarioPayload(params.caseId, params.scenarioId)) as Record<string, unknown>;
  const payloadScenarios = Array.isArray(payload.scenarios) ? payload.scenarios : [];
  const activeScenarioPayload = payloadScenarios.find(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      (entry as { id?: unknown }).id === params.scenarioId,
  ) as { assumptions?: Record<string, unknown> } | undefined;

  const assumptions = activeScenarioPayload?.assumptions ?? {};
  const investmentReturns =
    assumptions.investmentReturnAssumptions && typeof assumptions.investmentReturnAssumptions === "object"
      ? (assumptions.investmentReturnAssumptions as Record<string, unknown>)
      : {};

  const initialAssumptions: ScenarioAssumptionsDto = {
    inflationRate: typeof assumptions.inflationRate === "number" ? assumptions.inflationRate : 2,
    salaryGrowthRate: typeof assumptions.salaryGrowthRate === "number" ? assumptions.salaryGrowthRate : 3,
    investmentReturnPct:
      typeof investmentReturns.fund === "number"
        ? investmentReturns.fund
        : typeof investmentReturns.equity === "number"
          ? investmentReturns.equity
          : typeof investmentReturns.bond === "number"
            ? investmentReturns.bond
            : typeof investmentReturns.crypto === "number"
              ? investmentReturns.crypto
              : 5,
  };

  return (
    <>
      <Title order={3} mb="md">
        {nav("scenarioManagement")}
      </Title>
      <ScenarioSettingsClient
        caseId={params.caseId}
        activeScenarioId={params.scenarioId}
        scenarios={scenarios}
        assumptions={initialAssumptions}
      />
    </>
  );
}
