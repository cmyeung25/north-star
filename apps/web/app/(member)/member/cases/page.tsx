import { createCaseScenarioRepo } from "@north-star/adapters";
import { Container, Stack, Text, Title } from "@mantine/core";
import { createSupabaseServerClient } from "../../../../src/lib/supabase/server";
import { CasesList } from "../components/CasesList";

export default async function MemberCasesPage() {
  const repo = createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

  const cases = await repo.listCases();

  return (
    <Container size="xl" px={0}>
      <Stack gap="md">
        <div>
          <Title order={2}>案例管理</Title>
          <Text c="dimmed">管理你的案例，快速進入規劃工作區。</Text>
        </div>
        <CasesList cases={cases} />
      </Stack>
    </Container>
  );
}
