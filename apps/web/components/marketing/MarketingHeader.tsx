"use client";

import Image from "next/image";
import { Button, Group, Paper, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { Link } from "../../src/i18n/navigation";
import LanguageSwitcher from "../LanguageSwitcher";

export default function MarketingHeader() {
  const t = useTranslations("marketing.web");

  return (
    <Paper
      radius="xl"
      px="md"
      py="sm"
      bg="rgba(11, 27, 58, 0.55)"
      style={{ backdropFilter: "blur(6px)", border: "1px solid rgba(221, 231, 255, 0.2)" }}
    >
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Link href="/web" style={{ textDecoration: "none" }}>
          <Group gap="xs">
            <Image src="/aurin-icon-square-white.png" alt="Aurin" width={32} height={32} priority />
            <Text fw={700} c="white">
              Aurin
            </Text>
          </Group>
        </Link>

        <Group gap="xs">
          <LanguageSwitcher />
          <Button component={Link} href="/auth/login" variant="subtle" color="gray" size="xs">
            {t("cta.login")}
          </Button>
          <Button component={Link} href="/auth/login?intent=register" color="aurora" size="xs">
            {t("cta.start")}
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}
