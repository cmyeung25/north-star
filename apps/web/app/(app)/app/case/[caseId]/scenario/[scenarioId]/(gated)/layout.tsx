import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createCaseScenarioRepo } from "@north-star/adapters";
import { scenarioOnboardingPath } from "../../../../../../../../lib/routes/appRoutes";
import { createSupabaseServerClient } from "../../../../../../../../src/lib/supabase/server";

type LayoutProps = {
  params: { caseId: string; scenarioId: string };
  children: ReactNode;
};

const isScenarioStarted = (payload: Record<string, unknown>) => {
  const meta = payload.meta;
  const onboarded = Boolean(meta && typeof meta === "object" && (meta as { onboarded?: unknown }).onboarded === true);
  const events = payload.events;
  return onboarded && Array.isArray(events) && events.length > 0;
};

export default async function AppCaseScenarioGatedLayout({ params, children }: LayoutProps) {
  if (!params.caseId || !params.scenarioId) {
    notFound();
  }

  const repo = createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

  const payload = (await repo.loadScenarioPayload(params.caseId, params.scenarioId)) as Record<string, unknown>;

  if (!isScenarioStarted(payload)) {
    redirect(scenarioOnboardingPath(params.caseId, params.scenarioId));
  }

  return children;
}
