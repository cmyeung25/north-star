import { Card, SimpleGrid, Stack, Text, UnstyledButton } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../../../lib/i18n";

type AutoSnapshot = {
  label: string;
  month: string;
  cash: number;
  assets: number;
  liabilities: number;
  netWorth: number;
};

type AutoSnapshotsCardProps = {
  snapshots: AutoSnapshot[];
  currency: string;
  onSelectMonth?: (month: string) => void;
};

export default function AutoSnapshotsCard({
  snapshots,
  currency,
  onSelectMonth,
}: AutoSnapshotsCardProps) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const formatValue = (value: number) => formatCurrency(value, currency, locale);

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="md">
        <Stack gap={2}>
          <Text fw={600}>{t("snapshotsTitle")}</Text>
          <Text size="sm" c="dimmed">
            {t("snapshotsSubtitle")}
          </Text>
        </Stack>
        {snapshots.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t("snapshotsEmpty")}
          </Text>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="md">
            {snapshots.map((snapshot) => (
              <UnstyledButton
                key={`${snapshot.label}-${snapshot.month}`}
                onClick={() => onSelectMonth?.(snapshot.month)}
                style={{ textAlign: "left" }}
              >
                <Card withBorder radius="md" padding="md">
                  <Stack gap={4}>
                    <Text size="sm" c="dimmed" fw={500}>
                      {snapshot.label}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t("snapshotsMonth", { month: snapshot.month })}
                    </Text>
                    <Text fw={600} size="lg">
                      {formatValue(snapshot.netWorth)}
                    </Text>
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed">
                        {t("snapshotsCash")} · {formatValue(snapshot.cash)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t("snapshotsAssets")} · {formatValue(snapshot.assets)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t("snapshotsLiabilities")} · {formatValue(snapshot.liabilities)}
                      </Text>
                    </Stack>
                  </Stack>
                </Card>
              </UnstyledButton>
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Card>
  );
}
