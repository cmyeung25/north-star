"use client";

import Image from "next/image";
import { Anchor, Divider, Group, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { Link } from "../../src/i18n/navigation";

const footerLinks = ["features", "pricing", "privacy", "support"] as const;

export default function MarketingFooter() {
  const t = useTranslations("marketing.footer");

  return (
    <Stack gap="md" mt={24}>
      <Divider color="rgba(221, 231, 255, 0.35)" />
      <Group justify="space-between" align="flex-start" c="var(--mantine-color-polar-1)" wrap="wrap">
        <Stack gap={4}>
          <Group gap="xs">
            <Image src="/aurin-icon-square-white.png" alt="Aurin" width={24} height={24} />
            <Text fw={700} c="white">
              Aurin
            </Text>
          </Group>
          <Text size="sm">{t("tagline")}</Text>
        </Stack>
        <Group gap="lg" wrap="wrap">
          {footerLinks.map((linkKey) => (
            <Anchor key={linkKey} component={Link} href={`/web/${linkKey}`} c="var(--mantine-color-polar-1)">
              {t(`links.${linkKey}`)}
            </Anchor>
          ))}
        </Group>
      </Group>
    </Stack>
  );
}
