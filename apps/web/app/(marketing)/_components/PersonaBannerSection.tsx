"use client";

import { Badge, Box, Button, Group, List, Overlay, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuthModal } from "./AuthModalController";
import { MEMBER_JOURNEY_PRESET_MAP } from "../../../src/features/member/createCaseEntry";
import { trackMarketEntryEvent } from "../../../src/lib/analytics/marketEntry";

type PersonaKey = "officeSaver" | "coupleHome" | "newParents" | "mortgageOwner";

const personaKeys: PersonaKey[] = ["officeSaver", "coupleHome", "newParents", "mortgageOwner"];

const personaImages: Record<PersonaKey, string> = {
  officeSaver: "/marketing/personas/aurin_persona_banner_01.webp",
  coupleHome: "/marketing/personas/aurin_persona_banner_02.webp",
  newParents: "/marketing/personas/aurin_persona_banner_03.webp",
  mortgageOwner: "/marketing/personas/aurin_persona_banner_04.webp",
};

export default function PersonaBannerSection({ isSignedIn }: { isSignedIn: boolean }) {
  const t = useTranslations("marketing.web");
  const locale = useLocale();
  const router = useRouter();
  const { openAuthModal } = useAuthModal();

  return (
    <Stack gap="md">
      <Title order={2} c="white">
        {t("section.persona")}
      </Title>

      <Stack gap="xl">
        {personaKeys.map((key) => (
          <Paper
            key={key}
            radius="lg"
            withBorder
            p={0}
            bg="rgba(11, 27, 58, 0.55)"
            style={{ borderColor: "rgba(221, 231, 255, 0.2)", overflow: "hidden" }}
          >
            <Box
              pos="relative"
              mih={{ base: 360, md: 420 }}
              p={{ base: "md", md: "xl" }}
              style={{
                backgroundImage: `url(${personaImages[key]})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <Overlay
                gradient="linear-gradient(110deg, rgba(8, 15, 35, 0.92) 0%, rgba(8, 15, 35, 0.6) 45%, rgba(8, 15, 35, 0.2) 100%)"
                opacity={1}
                zIndex={0}
              />

              <Stack
                gap="sm"
                maw={560}
                pos="relative"
                style={{ zIndex: 1 }}
                p={{ base: "sm", md: "md" }}
                bg="rgba(8, 15, 35, 0.48)"
                bdrs="md"
              >
                <Badge variant="light" color="aurora" w="fit-content">
                  {t(`personas.${key}.tag`)}
                </Badge>
                <Title order={3} c="white">
                  {t(`personas.${key}.title`)}
                </Title>
                <Text c="gray.2">{t(`personas.${key}.tagline`)}</Text>
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
                <Group mt="xs">
                  <Button
                    variant="light"
                    color="gray"
                    onClick={() => {
                      const presetId = MEMBER_JOURNEY_PRESET_MAP[key];
                      trackMarketEntryEvent("journey_cta_click", {
                        locale,
                        journeyId: key,
                        presetId,
                        isSignedIn,
                      });
                      const params = new URLSearchParams({
                        journey: key,
                        preset: presetId,
                      });
                      const targetPath = `/${locale}/member/cases?${params.toString()}`;
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
                      openAuthModal("register");
                    }}
                  >
                    {t(`personas.${key}.cta`)}
                  </Button>
                </Group>
              </Stack>
            </Box>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}
