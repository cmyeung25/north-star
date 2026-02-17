import { notFound } from "next/navigation";
import { createCaseScenarioRepo, createEmptyScenarioPayload } from "@north-star/adapters";
import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import Link from "next/link";
import {
  scenarioDashboardPath,
  scenarioOnboardingPath,
} from "../../../../../lib/routes/appRoutes";
import { createSupabaseServerClient } from "../../../../../src/lib/supabase/server";
import { MemberShell } from "../../components/MemberShell";

type PageProps = { params: { caseId: string } };

export default async function CaseScenariosPage({ params }: PageProps) {
  const repo = createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

  const cases = await repo.listCases();
  const activeCase = cases.find((entry) => entry.id === params.caseId);

  if (!activeCase) {
    notFound();
  }

  const scenarios = await repo.listScenarios(params.caseId);
  const scenario = scenarios[0]
    ? scenarios[0]
    : await repo.createScenario(params.caseId, {
        title: "Scenario 1",
        payload: createEmptyScenarioPayload({
          currency: "HKD",
          caseId: params.caseId,
          createdFrom: "member-case-page-open",
        }),
      });

  const payload = await repo.loadScenarioPayload(params.caseId, scenario.id);
  const meta = payload && typeof payload === "object" ? (payload as { meta?: unknown }).meta : null;
  const onboarded = Boolean(meta && typeof meta === "object" && (meta as { onboarded?: unknown }).onboarded === true);
  const redirectPath = onboarded
    ? scenarioDashboardPath(params.caseId, scenario.id)
    : scenarioOnboardingPath(params.caseId, scenario.id);

  return (
    <MemberShell title={activeCase.title} description={`Case ID: ${activeCase.id}`}>
      <Stack>
        <Alert color="blue" title="Scenario management moved">
          Scenario create/duplicate/delete/rename has moved into App under Scenario Setting.
        </Alert>
        <Text c="dimmed">Use the button below to continue planning in App.</Text>
        <Group>
          <Button component={Link} href={redirectPath}>
            進入計劃
          </Button>
          <Button component={Link} href="/member/cases" variant="default">
            返回 Cases
          </Button>
        </Group>
      </Stack>
    </MemberShell>
  );
}
