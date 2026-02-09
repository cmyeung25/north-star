import {
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { defaultCurrency, formatCurrency } from "../../../lib/i18n";
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
  const locale = useLocale();
  const [previewSeed, setPreviewSeed] = useState<ScenarioSeedCard | null>(null);

  const summaryRows = useMemo(() => {
    if (!previewSeed) {
      return null;
    }
    const summary = previewSeed.summary;
    return [
      {
        label: t("seeds.previewMonthlyIncome"),
        value: formatCurrency(summary.monthlyIncome, defaultCurrency, locale),
      },
      {
        label: t("seeds.previewMonthlyExpense"),
        value: formatCurrency(summary.monthlyExpense, defaultCurrency, locale),
      },
      {
        label: t("seeds.previewMonthlyNet"),
        value: formatCurrency(summary.monthlyNet, defaultCurrency, locale),
      },
      {
        label: t("seeds.previewAssets"),
        value: formatCurrency(summary.assetsTotal, defaultCurrency, locale),
      },
      {
        label: t("seeds.previewLiabilities"),
        value: formatCurrency(summary.liabilitiesTotal, defaultCurrency, locale),
      },
    ];
  }, [locale, previewSeed, t]);

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
          <Card key={seed.id} withBorder radius="md" padding="lg">
            <Stack gap="sm">
              <Stack gap={4}>
                <Text fw={600}>{seed.title}</Text>
                <Text size="sm" c="dimmed">
                  {seed.description}
                </Text>
              </Stack>
              <Group gap="xs" wrap="wrap">
                {seed.tags.map((tag) => (
                  <Badge key={tag} variant="light" color="gray">
                    {tag}
                  </Badge>
                ))}
              </Group>
              <SimpleGrid cols={2} spacing="xs">
                {seed.keyNumbers.map((item) => (
                  <Stack key={item.label} gap={2}>
                    <Text size="xs" c="dimmed">
                      {item.label}
                    </Text>
                    <Text fw={600} size="sm">
                      {item.value}
                    </Text>
                  </Stack>
                ))}
              </SimpleGrid>
              <Group gap="sm" wrap="wrap">
                <Button onClick={() => onUseSeed(seed)}>{t("seeds.useSeed")}</Button>
                <Button variant="light" onClick={() => setPreviewSeed(seed)}>
                  {t("seeds.preview")}
                </Button>
              </Group>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      <Drawer
        opened={Boolean(previewSeed)}
        onClose={() => setPreviewSeed(null)}
        title={t("seeds.previewTitle")}
        position="right"
        size="md"
      >
        {previewSeed && (
          <Stack gap="md">
            <Stack gap={4}>
              <Text fw={600}>{previewSeed.title}</Text>
              <Text size="sm" c="dimmed">
                {previewSeed.description}
              </Text>
            </Stack>

            <Stack gap={4}>
              <Text size="sm" fw={600}>
                {t("seeds.previewMembers")}
              </Text>
              <Text size="sm" c="dimmed">
                {previewSeed.payload.members.map((member) => member.name).join(" · ")}
              </Text>
            </Stack>

            {summaryRows && (
              <SimpleGrid cols={2} spacing="sm">
                {summaryRows.map((row) => (
                  <Stack key={row.label} gap={2}>
                    <Text size="xs" c="dimmed">
                      {row.label}
                    </Text>
                    <Text fw={600} size="sm">
                      {row.value}
                    </Text>
                  </Stack>
                ))}
              </SimpleGrid>
            )}

            <Stack gap={4}>
              <Text size="sm" fw={600}>
                {t("seeds.previewBundles")}
              </Text>
              {previewSeed.summary.bundles.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t("seeds.previewBundlesEmpty")}
                </Text>
              ) : (
                <Stack gap={6}>
                  {previewSeed.summary.bundles.map((bundle) => (
                    <Group key={bundle.id} justify="space-between" wrap="wrap">
                      <Text size="sm">{bundle.title}</Text>
                      <Text size="xs" c="dimmed">
                        {t("seeds.previewStartMonth")}: {bundle.startMonth}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              )}
            </Stack>
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}
