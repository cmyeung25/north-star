import { Button, Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../../../lib/i18n";
import type { ProjectionSnapshot } from "../../../src/store/scenarioStore";

type SnapshotPreset = {
  label: string;
  monthIndex: number;
  disabled?: boolean;
};

type SnapshotsCardProps = {
  snapshots: ProjectionSnapshot[];
  months: string[];
  currency: string;
  presets: SnapshotPreset[];
  onAddSnapshot: (preset: SnapshotPreset) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  onExportCsv: () => void;
  onExportJson: () => void;
};

export default function SnapshotsCard({
  snapshots,
  months,
  currency,
  presets,
  onAddSnapshot,
  onDeleteSnapshot,
  onExportCsv,
  onExportJson,
}: SnapshotsCardProps) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const formatValue = (value: number) => formatCurrency(value, currency, locale);

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={2}>
            <Text fw={600}>{t("snapshotsTitle")}</Text>
            <Text size="sm" c="dimmed">
              {t("snapshotsSubtitle")}
            </Text>
          </Stack>
          <Group gap="xs">
            <Button size="xs" variant="light" onClick={onExportCsv}>
              {t("snapshotsExportCsv")}
            </Button>
            <Button size="xs" variant="light" onClick={onExportJson}>
              {t("snapshotsExportJson")}
            </Button>
          </Group>
        </Group>

        <Group gap="xs" wrap="wrap">
          {presets.map((preset) => (
            <Button
              key={`${preset.label}-${preset.monthIndex}`}
              size="xs"
              variant="default"
              onClick={() => onAddSnapshot(preset)}
              disabled={preset.disabled}
            >
              {t("snapshotsAddPreset", { label: preset.label })}
            </Button>
          ))}
        </Group>

        {snapshots.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t("snapshotsEmpty")}
          </Text>
        ) : (
          <Stack gap="sm">
            {snapshots.map((snapshot) => {
              const monthLabel = months[snapshot.monthIndex];
              return (
                <Card key={snapshot.id} withBorder radius="md" padding="sm">
                  <Stack gap="xs">
                    <Group justify="space-between" align="center">
                      <Stack gap={2}>
                        <Text fw={600}>{snapshot.label}</Text>
                        <Text size="xs" c="dimmed">
                          {monthLabel
                            ? t("snapshotsMonth", { month: monthLabel })
                            : t("snapshotsMonthMissing")}
                        </Text>
                      </Stack>
                      <Button
                        size="xs"
                        color="red"
                        variant="subtle"
                        onClick={() => onDeleteSnapshot(snapshot.id)}
                      >
                        {t("snapshotsDelete")}
                      </Button>
                    </Group>
                    <SimpleGrid cols={{ base: 1, sm: 4 }}>
                      <Stack gap={2}>
                        <Text size="xs" c="dimmed">
                          {t("snapshotsCash")}
                        </Text>
                        <Text fw={500}>{formatValue(snapshot.cash)}</Text>
                      </Stack>
                      <Stack gap={2}>
                        <Text size="xs" c="dimmed">
                          {t("snapshotsAssets")}
                        </Text>
                        <Text fw={500}>{formatValue(snapshot.assets)}</Text>
                      </Stack>
                      <Stack gap={2}>
                        <Text size="xs" c="dimmed">
                          {t("snapshotsLiabilities")}
                        </Text>
                        <Text fw={500}>{formatValue(snapshot.liabilities)}</Text>
                      </Stack>
                      <Stack gap={2}>
                        <Text size="xs" c="dimmed">
                          {t("snapshotsNetWorth")}
                        </Text>
                        <Text fw={500}>{formatValue(snapshot.netWorth)}</Text>
                      </Stack>
                    </SimpleGrid>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
