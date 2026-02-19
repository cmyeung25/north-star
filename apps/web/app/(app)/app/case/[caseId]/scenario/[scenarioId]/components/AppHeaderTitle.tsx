"use client";

import { Skeleton, Stack, Text, Title } from "@mantine/core";

type AppHeaderTitleProps = {
  caseTitle?: string;
  scenarioTitle: string;
};

export default function AppHeaderTitle({ caseTitle, scenarioTitle }: AppHeaderTitleProps) {
  if (!caseTitle) {
    return (
      <Stack gap={4} maw={520} miw={0}>
        <Skeleton height={18} width={260} radius="sm" />
        <Skeleton height={12} width={180} radius="sm" />
      </Stack>
    );
  }

  return (
    <Stack gap={0} maw={560} miw={0}>
      <Title order={4} lh={1.3} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {caseTitle} — {scenarioTitle}
      </Title>
      <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        Scenario workspace
      </Text>
    </Stack>
  );
}
