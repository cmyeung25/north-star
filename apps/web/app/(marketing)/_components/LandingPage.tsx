"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Accordion, Anchor, Badge, Button, Card, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title, useMantineTheme } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useAuthModal } from "./AuthModalController";
import { createSupabaseBrowserClient } from "../../../src/lib/supabase/browser";
import { trackMarketEntryEvent } from "../../../src/lib/analytics/marketEntry";
import PersonaBannerSection from "./PersonaBannerSection";
import SampleJourneySection from "./SampleJourneySection";

export default function LandingPage() {
  const t = useTranslations("marketing.web");
  const locale = useLocale();
  const router = useRouter();
  const { openAuthModal } = useAuthModal();
  const theme = useMantineTheme();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const didTrackLandingViewRef = useRef(false);
  const resolvedIsSignedIn = isSignedIn ?? false;

  useEffect(() => {
    if (isSignedIn === null || didTrackLandingViewRef.current) {
      return;
    }
    didTrackLandingViewRef.current = true;
    trackMarketEntryEvent("market_landing_view", {
      locale,
      journeyId: null,
      presetId: null,
      isSignedIn,
    });
  }, [isSignedIn, locale]);

  const openAuthFromLanding = (journeyId: string | null, presetId: string | null, tab: "login" | "register") => {
    trackMarketEntryEvent("auth_modal_open", {
      locale,
      journeyId,
      presetId,
      isSignedIn: resolvedIsSignedIn,
    });
    openAuthModal(tab);
  };

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (mounted) {
        setIsSignedIn(Boolean(user));
      }
    };

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session?.user));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const pillarKeys = ["clarity", "control", "confidence"] as const;
  const stepKeys = ["one", "two", "three"] as const;
  const faqKeys = ["one", "two", "three", "four", "five", "six", "seven", "eight"] as const;

  return (
    <Stack gap={56}>
      <Paper
        radius="xl"
        p={{ base: "lg", md: 32 }}
        bg="rgba(11, 27, 58, 0.4)"
        style={{ border: "1px solid rgba(221, 231, 255, 0.16)", backdropFilter: "blur(10px)" }}
      >
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: "xl", md: 32 }}>
          <Stack gap="lg" justify="center">
            <Badge variant="light" color="aurora" size="lg" w="fit-content">
              {t("hero.badge")}
            </Badge>
            <Stack gap="sm">
              <Title order={1} c="white" maw={560}>
                {t("hero.title")}
              </Title>
              <Text c="var(--mantine-color-polar-1)" maw={560}>
                {t("hero.subtitle")}
              </Text>
            </Stack>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              {(["cashflow", "netWorth", "guardrails"] as const).map((key) => (
                <Paper
                  key={key}
                  p="md"
                  radius="lg"
                  bg="rgba(255,255,255,0.04)"
                  style={{ border: "1px solid rgba(221, 231, 255, 0.12)" }}
                >
                  <Stack gap={6}>
                    <Text size="xs" tt="uppercase" fw={700} c="aurora.2">
                      {t(`hero.proof.${key}.label`)}
                    </Text>
                    <Text c="white" fw={600}>
                      {t(`hero.proof.${key}.title`)}
                    </Text>
                    <Text size="sm" c="var(--mantine-color-polar-2)">
                      {t(`hero.proof.${key}.description`)}
                    </Text>
                  </Stack>
                </Paper>
              ))}
            </SimpleGrid>
            <Stack gap="xs">
              <Group gap="sm" wrap="wrap">
                <Button size="md" color="aurora" onClick={() => (resolvedIsSignedIn ? router.push(`/${locale}/member/cases`) : openAuthFromLanding(null, null, "register"))}>
                  {t("cta.start")}
                </Button>
                <Button size="md" variant="outline" c="white" onClick={() => openAuthFromLanding(null, null, "login")}>
                  {t("cta.login")}
                </Button>
                {resolvedIsSignedIn ? (
                  <Anchor c="aurora.2" fw={600} onClick={() => router.push(`/${locale}/member/cases`)} style={{ cursor: "pointer" }}>
                    {t("cta.goCases")}
                  </Anchor>
                ) : null}
              </Group>
              <Group gap="lg">
                <Text size="sm" c="var(--mantine-color-polar-2)">
                  {t("cta.startHint")}
                </Text>
                <Text size="sm" c="var(--mantine-color-polar-2)">
                  {t("cta.loginHint")}
                </Text>
              </Group>
            </Stack>
          </Stack>
          <Stack gap="md">
            <Card
              bg="rgba(8, 15, 35, 0.72)"
              style={{ borderColor: "rgba(184, 203, 255, 0.28)" }}
              p="xl"
            >
              <Stack gap="md">
                <Text fw={700} c="white">
                  {t("snapshot.title")}
                </Text>
                <Paper p="md" radius="md" bg="rgba(35, 213, 171, 0.12)">
                  <Text fw={600} c="white">
                    {t("snapshot.case")}
                  </Text>
                  <Text size="sm" c="var(--mantine-color-polar-1)">
                    {t("snapshot.detail")}
                  </Text>
                </Paper>
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                  <Paper p="sm" radius="md" bg="rgba(255,255,255,0.04)">
                    <Stack gap={4}>
                      <Text size="xs" tt="uppercase" fw={700} c="aurora.2">
                        {t("snapshot.points.cashflow")}
                      </Text>
                      <Text size="sm" c="gray.1">
                        {t("snapshot.summary.cashflow")}
                      </Text>
                    </Stack>
                  </Paper>
                  <Paper p="sm" radius="md" bg="rgba(255,255,255,0.04)">
                    <Stack gap={4}>
                      <Text size="xs" tt="uppercase" fw={700} c="aurora.2">
                        {t("snapshot.points.netWorth")}
                      </Text>
                      <Text size="sm" c="gray.1">
                        {t("snapshot.summary.netWorth")}
                      </Text>
                    </Stack>
                  </Paper>
                  <Paper p="sm" radius="md" bg="rgba(255,255,255,0.04)">
                    <Stack gap={4}>
                      <Text size="xs" tt="uppercase" fw={700} c="aurora.2">
                        {t("snapshot.points.guardrails")}
                      </Text>
                      <Text size="sm" c="gray.1">
                        {t("snapshot.summary.guardrails")}
                      </Text>
                    </Stack>
                  </Paper>
                </SimpleGrid>
              </Stack>
            </Card>
            <Card bg="rgba(255,255,255,0.04)" p="lg" radius="xl" style={{ border: "1px solid rgba(221, 231, 255, 0.1)" }}>
              <Stack gap="xs">
                <Text size="xs" tt="uppercase" fw={700} c="aurora.2">
                  {t("hero.firstSession.label")}
                </Text>
                <Title order={4} c="white">
                  {t("hero.firstSession.title")}
                </Title>
                <Text c="var(--mantine-color-polar-1)">
                  {t("hero.firstSession.description")}
                </Text>
              </Stack>
            </Card>
          </Stack>
        </SimpleGrid>
      </Paper>

      <Stack gap="md">
        <Title order={2} c="white">
          {t("section.pillars")}
        </Title>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          {pillarKeys.map((key) => (
            <Card key={key} bg="rgba(255,255,255,0.96)">
              <Stack gap="xs">
                <Group gap="xs" align="center">
                  <ThemeIcon radius="xl" color="aurora" variant="light" size="lg">
                    <Text>{t(`pillars.${key}.icon`)}</Text>
                  </ThemeIcon>
                  <Text fw={700}>{t(`pillars.${key}.title`)}</Text>
                </Group>
                <Text size="sm" c="dimmed">
                  {t(`pillars.${key}.description`)}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>

      <PersonaBannerSection isSignedIn={resolvedIsSignedIn} />

      <SampleJourneySection isSignedIn={resolvedIsSignedIn} />

      <Stack gap="md">
        <Title order={2} c="white">
          {t("section.flow")}
        </Title>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          {stepKeys.map((key, index) => (
            <Card key={key} bg="rgba(255,255,255,0.96)">
              <Stack gap="xs">
                <Badge variant="filled" color="aurora" w="fit-content">
                  {t("flow.step", { number: index + 1 })}
                </Badge>
                <Text fw={700}>{t(`flow.${key}.title`)}</Text>
                <Text size="sm" c="dimmed">
                  {t(`flow.${key}.description`)}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>

      <Stack gap="md">
        <Title order={2} c="white">
          {t("section.faq")}
        </Title>
        <Paper
          radius="lg"
          p={{ base: "md", sm: "lg" }}
          bg={theme.colors.dark[7]}
          withBorder
          style={{ borderColor: "rgba(221, 231, 255, 0.22)" }}
        >
          <Accordion
            radius="md"
            variant="separated"
            styles={{
              item: {
                background: "transparent",
                borderColor: "rgba(221, 231, 255, 0.18)",
              },
              control: {
                background: "rgba(221, 231, 255, 0.08)",
                color: theme.white,
              },
              chevron: { color: theme.white },
              label: {
                color: theme.colors.gray[1],
                fontWeight: 600,
              },
              panel: {
                background: "rgba(11, 27, 58, 0.45)",
                color: theme.colors.gray[1],
              },
            }}
          >
            {faqKeys.map((key) => (
              <Accordion.Item key={key} value={key}>
                <Accordion.Control>{t(`faq.${key}.q`)}</Accordion.Control>
                <Accordion.Panel>{t(`faq.${key}.a`)}</Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Paper>
      </Stack>

      <Paper p="xl" radius="lg" bg="rgba(35, 213, 171, 0.12)" style={{ border: "1px solid rgba(35, 213, 171, 0.35)" }}>
        <Stack gap="sm" align="flex-start">
          <Title order={3} c="white">
            {t("finalCta.title")}
          </Title>
          <Text c="var(--mantine-color-polar-1)">{t("finalCta.subtitle")}</Text>
          <Group gap="sm" wrap="wrap">
            <Button color="aurora" onClick={() => (resolvedIsSignedIn ? router.push(`/${locale}/member/cases`) : openAuthFromLanding(null, null, "register"))}>
              {t("cta.start")}
            </Button>
            <Button onClick={() => (resolvedIsSignedIn ? router.push(`/${locale}/member/cases`) : openAuthFromLanding(null, null, "register"))} variant="outline" c="white">
              {t("cta.createCase")}
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}
