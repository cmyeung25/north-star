"use client";

import React from "react";
import { Card, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";

type MoneyLegacyBannerProps = {
  schemaVersion?: number;
};

export default function MoneyLegacyBanner({ schemaVersion }: MoneyLegacyBannerProps) {
  const t = useTranslations("money");

  if (schemaVersion === 2) {
    return null;
  }

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap={4}>
        <Text fw={600}>{t("legacyBannerTitle")}</Text>
        <Text size="sm" c="dimmed">
          {t("legacyBannerBody")}
        </Text>
      </Stack>
    </Card>
  );
}
