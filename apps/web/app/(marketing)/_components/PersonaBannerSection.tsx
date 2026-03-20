"use client";

import { Badge, Button, Card, Group, List, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuthModal } from "./AuthModalController";
import {
  buildMemberCasesEntryHref,
  MEMBER_JOURNEY_PRESET_MAP,
  type MemberJourneyId,
} from "../../../src/features/member/createCaseEntry";
import { trackMarketEntryEvent } from "../../../src/lib/analytics/marketEntry";

type PersonaKey = MemberJourneyId;

const personaKeys: PersonaKey[] = ["officeSaver", "coupleHome", "newParents", "mortgageOwner"];

export default function PersonaBannerSection({ isSignedIn }: { isSignedIn: boolean }) {
  const t = useTranslations("marketing.web");
  const locale = useLocale();
  const router = useRouter();
  const { openAuthModal } = useAuthModal();

  return (
    <Stack gap="md">
      <Stack gap={6}>
        <Title order={2} c="white">
          {t("section.persona")}
        </Title>
        <Text c="var(--mantine-color-polar-1)" maw={720}>
          {t("section.personaSubtitle")}
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {personaKeys.map((key) => (
          <Card
            key={key}
            radius="xl"
            p="xl"
            bg="rgba(11, 27, 58, 0.6)"
            style={{ border: "1px solid rgba(221, 231, 255, 0.16)" }}
          >
            <Stack gap="lg" h="100%" justify="space-between">
              <Stack gap="sm">
                <Badge variant="light" color="aurora" w="fit-content">
                  {t(`personas.${key}.tag`)}
                </Badge>
                <Title order={3} c="white">
                  {t(`personas.${key}.title`)}
                </Title>
                <Text c="gray.2" maw={520}>
                  {t(`personas.${key}.tagline`)}
                </Text>
                <List
                  spacing="xs"
                  size="sm"
                  icon={
                    <ThemeIcon color="aurora" size={20} radius="xl" variant="light">
                      <Text size="xs">✓</Text>
                    </ThemeIcon>
                  }
                >
                  <List.Item c="gray.1">{t(`personas.${key}.bullets.0`)}</List.Item>
                  <List.Item c="gray.1">{t(`personas.${key}.bullets.1`)}</List.Item>
                  <List.Item c="gray.1">{t(`personas.${key}.bullets.2`)}</List.Item>
                </List>
              </Stack>
              <Stack gap="sm">
                <Card bg="rgba(255,255,255,0.04)" radius="lg" p="md">
                  <Stack gap={4}>
                    <Text size="xs" tt="uppercase" fw={700} c="aurora.2">
                      {t("personaCard.outcomeLabel")}
                    </Text>
                    <Text c="white" fw={600}>
                      {t(`personas.${key}.outcome`)}
                    </Text>
                    <Text size="sm" c="gray.3">
                      {t(`personas.${key}.decision`)}
                    </Text>
                  </Stack>
                </Card>
                <Group mt="xs">
                  <Button
                    variant="light"
                    color="gray"
                    onClick={() => {
                      const presetId = MEMBER_JOURNEY_PRESET_MAP[key];
                      const entryIntent = {
                        journey: key,
                        presetId,
                      } as const;
                      trackMarketEntryEvent("journey_cta_click", {
                        locale,
                        journeyId: key,
                        presetId,
                        isSignedIn,
                      });
                      const targetPath = buildMemberCasesEntryHref(locale, entryIntent);
                      if (isSignedIn) {
                        router.push(targetPath);
                        return;
                      }
                      trackMarketEntryEvent("auth_modal_open", {
                        locale,
                        journeyId: key,
                        presetId,
                        isSignedIn,
                      });
                      openAuthModal("register", entryIntent);
                    }}
                  >
                    {t(`personas.${key}.cta`)}
                  </Button>
                </Group>
              </Stack>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
