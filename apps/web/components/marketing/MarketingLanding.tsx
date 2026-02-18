"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Anchor, Button, Container, Group, Stack, Text, Title } from "@mantine/core";
import BrandLogo from "../brand/BrandLogo";

export default function MarketingLanding() {
  const t = useTranslations("marketing");

  return (
    <Container size="sm" py={56}>
      <Stack gap="lg" align="flex-start">
        <BrandLogo href="/web" size="lg" />
        <Stack gap="xs">
          <Title order={1}>{t("hero.title")}</Title>
          <Text c="dimmed" maw={640}>
            {t("hero.subtitle")}
          </Text>
        </Stack>
        <Group gap="sm" wrap="wrap">
          <Button component={Link} href="/web" size="md">
            {t("cta.start")}
          </Button>
          <Button component={Link} href="/auth/login" variant="outline" size="md">
            {t("cta.login")}
          </Button>
          <Anchor component={Link} href="/member/cases" fw={600}>
            {t("cta.goCases")}
          </Anchor>
        </Group>
      </Stack>
    </Container>
  );
}
