import { notFound } from "next/navigation";
import { createCaseScenarioRepo, createEmptyScenarioPayload } from "@north-star/adapters";
import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import Link from "next/link";
import {
  scenarioDashboardPath,
  scenarioOnboardingPath,
} from "../../../../../../lib/routes/appRoutes";
import { isScenarioOnboarded } from "../../../../../../lib/scenario/isScenarioOnboarded";
import { createSupabaseServerClient } from '../../../../../../src/lib/supabase/server';
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
  const scenario = scenarios.length > 0
    ? [...scenarios].sort((left, right) => {
        const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : Number.NEGATIVE_INFINITY;
        const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : Number.NEGATIVE_INFINITY;
        return rightTime - leftTime;
      })[0]
    : await repo.createScenario(params.caseId, {
        title: "Scenario 1",
        payload: createEmptyScenarioPayload({
          currency: "HKD",
          caseId: params.caseId,
          createdFrom: "member-case-page-open",
        }),
      });

  const payload = await repo.loadScenarioPayload(params.caseId, scenario.id);
  const onboarded = isScenarioOnboarded(payload, scenario.id);
  const redirectPath = onboarded
    ? scenarioDashboardPath(params.caseId, scenario.id)
    : scenarioOnboardingPath(params.caseId, scenario.id);

  return (
    <MemberShell title={activeCase.title} description={`Case ID: ${activeCase.id}`}>
      <Stack>
        <Alert color="blue" title="情境管理已移動">
          建立/複製/刪除/重命名情境已移到 App 內的情境設定。
        </Alert>
        <Text c="dimmed">請用以下按鈕繼續規劃。</Text>
        <Group>
          <Button component={Link} href={redirectPath}>
            進入計劃
          </Button>
          <Button component={Link} href="/member/cases" variant="default">
            返回個案
          </Button>
        </Group>
      </Stack>
    </MemberShell>
  );
}
