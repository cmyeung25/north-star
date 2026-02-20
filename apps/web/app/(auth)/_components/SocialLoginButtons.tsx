"use client";

import { Badge, Button, Stack, Tooltip } from "@mantine/core";
import { useTranslations } from "next-intl";

export default function SocialLoginButtons() {
  const t = useTranslations("auth.modal");

  const buttons = [
    { key: "google", icon: "G", label: t("social.google") },
    { key: "facebook", icon: "f", label: t("social.facebook") },
  ] as const;

  return (
    <Stack gap="xs">
      {buttons.map(({ key, icon, label }) => (
        <Tooltip key={key} label={t("social.tooltip")} withArrow>
          <span>
            <Button
              variant="default"
              fullWidth
              disabled
              leftSection={icon}
              justify="space-between"
              rightSection={<Badge size="xs">{t("social.comingSoon")}</Badge>}
            >
              {label}
            </Button>
          </span>
        </Tooltip>
      ))}
    </Stack>
  );
}
