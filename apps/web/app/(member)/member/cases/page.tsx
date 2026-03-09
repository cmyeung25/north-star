import { createCaseScenarioRepo } from "@north-star/adapters";
import { Container, Stack, Text, Title } from "@mantine/core";
import { createSupabaseServerClient } from "../../../../src/lib/supabase/server";
import { CasesList } from "../components/CasesList";
import { resolveMemberCasesEntryIntent } from "../../../../src/features/member/createCaseEntry";

export default async function MemberCasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const repo = createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

  const cases = await repo.listCases();
  const entryIntent = resolveMemberCasesEntryIntent(await searchParams);

  return (
    <Container size="xl" px={0}>
      <Stack gap="md">
        <div>
          <Title order={2}>案例管理</Title>
          <Text c="dimmed">管理你的案例，快速進入規劃工作區。</Text>
        </div>
        <CasesList cases={cases} entryIntent={entryIntent} />
      </Stack>
    </Container>
  );
}
