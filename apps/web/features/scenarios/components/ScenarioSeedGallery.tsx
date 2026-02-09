import { Badge, Button, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useTranslations } from "next-intl";
import type { ScenarioSeedCard } from "../../../src/scenarios/scenarioSeeds";

export type ScenarioSeedGalleryProps = {
  seeds: ScenarioSeedCard[];
  onUseSeed: (seed: ScenarioSeedCard) => void;
};

export default function ScenarioSeedGallery({
  seeds,
  onUseSeed,
}: ScenarioSeedGalleryProps) {
  const t = useTranslations("scenarios");

  if (seeds.length === 0) {
    return null;
  }

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Title order={4}>{t("seeds.sectionTitle")}</Title>
        <Text size="sm" c="dimmed">
          {t("seeds.sectionDescription")}
        </Text>
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {seeds.map((seed) => (
          <Card key={seed.seedKey} withBorder radius="md" padding="lg">
            <Stack gap="sm">
              <Stack gap={4}>
                <Text fw={600}>{seed.title}</Text>
                <Text size="sm" c="dimmed">
                  {seed.subtitle}
                </Text>
              </Stack>
              <Group gap="xs" wrap="wrap">
                {seed.tags.map((tag) => (
                  <Badge key={tag} variant="light" color="gray">
                    {tag}
                  </Badge>
                ))}
              </Group>
              <Button variant="light" onClick={() => onUseSeed(seed)}>
                {t("seeds.useSeed")}
              </Button>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
