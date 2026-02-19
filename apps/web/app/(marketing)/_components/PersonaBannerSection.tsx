import Link from "next/link";
import { Badge, Box, Button, Group, List, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { useTranslations } from "next-intl";

type PersonaKey = "officeSaver" | "coupleHome" | "newParents" | "mortgageOwner";

const personaKeys: PersonaKey[] = ["officeSaver", "coupleHome", "newParents", "mortgageOwner"];

const personaImages: Record<PersonaKey, string> = {
  officeSaver: "https://picsum.photos/seed/aurin-office/1600/900",
  coupleHome: "https://picsum.photos/seed/aurin-couple-home/1600/900",
  newParents: "https://picsum.photos/seed/aurin-new-parents/1600/900",
  mortgageOwner: "https://picsum.photos/seed/aurin-mortgage-owner/1600/900",
};

export default function PersonaBannerSection({ isSignedIn }: { isSignedIn: boolean }) {
  const t = useTranslations("marketing.web");
  const ctaHref = isSignedIn ? "/member/cases" : "/auth/login?intent=register";

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
            p={{ base: "md", md: "xl" }}
            bg="rgba(11, 27, 58, 0.55)"
            style={{ borderColor: "rgba(221, 231, 255, 0.2)" }}
          >
            <SimpleGrid visibleFrom="md" cols={2} spacing="xl">
              <Stack justify="center" gap="sm">
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
                  <Button component={Link} href={ctaHref} variant="light" color="gray">
                    {t(`personas.${key}.cta`)}
                  </Button>
                </Group>
              </Stack>
              <Box h={320} style={{ borderRadius: "var(--mantine-radius-md)", backgroundImage: `linear-gradient(120deg, rgba(8, 15, 35, 0.8) 0%, rgba(8, 15, 35, 0.28) 60%, rgba(35, 213, 171, 0.15) 100%), url(${personaImages[key]})`, backgroundSize: "cover", backgroundPosition: "center" }} />
            </SimpleGrid>

            <Stack hiddenFrom="md" gap="md">
              <Box h={220} style={{ borderRadius: "var(--mantine-radius-md)", backgroundImage: `linear-gradient(120deg, rgba(8, 15, 35, 0.8) 0%, rgba(8, 15, 35, 0.28) 60%, rgba(35, 213, 171, 0.15) 100%), url(${personaImages[key]})`, backgroundSize: "cover", backgroundPosition: "center" }} />
              <Stack justify="center" gap="sm">
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
                  <Button component={Link} href={ctaHref} variant="light" color="gray">
                    {t(`personas.${key}.cta`)}
                  </Button>
                </Group>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}
