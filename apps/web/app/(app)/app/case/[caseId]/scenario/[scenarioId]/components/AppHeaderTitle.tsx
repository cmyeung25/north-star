"use client";

import { Skeleton, Stack, Text, Title } from "@mantine/core";
import { useTranslations } from "next-intl";

type AppHeaderTitleProps = {
  caseTitle?: string;
  scenarioTitle: string;
  loading?: boolean;
};

export default function AppHeaderTitle({ caseTitle, scenarioTitle, loading = false }: AppHeaderTitleProps) {
  const t = useTranslations("app.shell");

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
        {caseTitle} — {loading ? "..." : scenarioTitle}
      </Title>
      <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {t("workspace")}
      </Text>
    </Stack>
  );
}
