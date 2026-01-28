import { Card, Grid, Group, NumberInput, Select, Stack, Text, Title } from "@mantine/core";
import type { OnboardingSettingsDraft } from "../../../domain/onboarding/applyDraft";
import MonthField from "../../../../components/MonthField";

interface StepGlobalSettingsProps {
  settings: OnboardingSettingsDraft;
  errors: Record<string, string>;
  onChange: (patch: Partial<OnboardingSettingsDraft>) => void;
  t: (key: string) => string;
}

export default function StepGlobalSettings({
  settings,
  errors,
  onChange,
  t,
}: StepGlobalSettingsProps) {
  const horizonYears = Math.round((settings.horizonMonths / 12) * 10) / 10;

  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={4}>{t("settingsTitle")}</Title>
        <Text size="sm" c="dimmed">
          {t("settingsDescription")}
        </Text>
      </Stack>
      <Grid justify="center" align="flex-start">
        <Grid.Col span={6}>
          <Card withBorder radius="md" padding="md">
            <Group align="flex-start" grow mb="md">
              <NumberInput
                display="inlineblock"
                label={t("initialCash")}
                description={t("initialCashHint")}
                min={0}
                value={settings.initialCash}
                onChange={(value) => onChange({ initialCash: Number(value) })}
              />
            </Group>
            <Group align="flex-start" grow mb="md">
              <MonthField
                label={t("baseMonth")}
                placeholder="YYYY-MM"
                value={settings.baseMonth}
                onChange={(value) => onChange({ baseMonth: value })}
                error={errors.baseMonth}
              />
            </Group>
            <Group align="flex-start" grow mb="md">
              <NumberInput
                label={t("horizonMonths")}
                description={horizonYears + t("horizonMonthsHint")}
                min={12}
                value={settings.horizonMonths}
                onChange={(value) => onChange({ horizonMonths: Number(value) })}
                error={errors.horizonMonths}
              />
            </Group>
            <Group align="flex-start" grow mb="md">
              <NumberInput
                label={t("annualInflation")}
                min={-5}
                max={20}
                step={0.1}
                value={settings.annualInflationPct}
                onChange={(value) => onChange({ annualInflationPct: Number(value) })}
                error={errors.annualInflationPct}
              />
            </Group>
            <Group align="flex-start" grow mb="md">
              <Select
                label={t("viewMode")}
                data={[
                  { value: "nominal", label: t("viewModeNominal") },
                  { value: "real", label: t("viewModeReal") },
                ]}
                value={settings.viewMode}
                onChange={(value) =>
                  onChange({ viewMode: (value ?? "nominal") as "nominal" | "real" })
                }
              />
            </Group>
          </Card>
        </Grid.Col>

      </Grid>
    </Stack>
  );
}
