import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createCaseScenarioRepo } from "@north-star/adapters";
import { createSupabaseServerClient } from "../../../../../../../src/lib/supabase/server";
import ScenarioHydrator from "./ScenarioHydrator";
import ScenarioAppShellV2 from "./ScenarioAppShellV2";

type LayoutProps = {
  params: { caseId: string; scenarioId: string };
  children: ReactNode;
};

const isScenarioStarted = (payload: Record<string, unknown>) => {
  const meta = payload.meta;
  if (meta && typeof meta === "object" && (meta as { onboarded?: unknown }).onboarded === true) {
    return true;
  }

  const members = payload.members;
  if (Array.isArray(members) && members.length > 0) {
    return true;
  }

  const scenarios = payload.scenarios;
  if (!Array.isArray(scenarios)) {
    return false;
  }

  return scenarios.some((scenario) => {
    if (!scenario || typeof scenario !== "object") {
      return false;
    }

    const candidate = scenario as {
      events?: unknown[];
      assets?: unknown[];
      liabilities?: unknown[];
      positions?: {
        homes?: unknown[];
        cars?: unknown[];
        investments?: unknown[];
        insurances?: unknown[];
        loans?: unknown[];
        cashBuckets?: unknown[];
      };
    };

    if (Array.isArray(candidate.events) && candidate.events.length > 0) {
      return true;
    }

    if (Array.isArray(candidate.assets) && candidate.assets.length > 0) {
      return true;
    }

    if (Array.isArray(candidate.liabilities) && candidate.liabilities.length > 0) {
      return true;
    }

    const positions = candidate.positions;
    if (!positions || typeof positions !== "object") {
      return false;
    }

    return [
      positions.homes,
      positions.cars,
      positions.investments,
      positions.insurances,
      positions.loans,
      positions.cashBuckets,
    ].some((entry) => Array.isArray(entry) && entry.length > 0);
  });
};

export default async function AppCaseScenarioLayout({ params, children }: LayoutProps) {
  const repo = createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

  const scenarios = await repo.listScenarios(params.caseId);
  const scenario = scenarios.find((entry) => entry.id === params.scenarioId);

  if (!scenario) {
    notFound();
  }

  const payload = await repo.loadScenarioPayload(params.caseId, params.scenarioId);
  const requestPath = headers().get("x-invoke-path") ?? headers().get("next-url") ?? "";
  const isOnboardingRoute = requestPath.includes("/onboarding");

  if (!isOnboardingRoute && !isScenarioStarted(payload as Record<string, unknown>)) {
    redirect(`/app/case/${params.caseId}/scenario/${params.scenarioId}/onboarding`);
  }

  return (
    <ScenarioHydrator
      caseId={params.caseId}
      scenarioId={params.scenarioId}
      payload={payload}
      revision={scenario.revision}
      lastSavedAt={scenario.updatedAt}
    >
      <ScenarioAppShellV2 title={scenario.title}>{children}</ScenarioAppShellV2>
    </ScenarioHydrator>
  );
}
