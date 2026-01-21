import { Group, NumberInput, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import type { OnboardingSettingsDraft } from "../../../domain/onboarding/applyDraft";

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
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={4}>{t("settingsTitle")}</Title>
        <Text size="sm" c="dimmed">
          {t("settingsDescription")}
        </Text>
      </Stack>

      <Group grow align="flex-start">
        <TextInput
          label={t("baseMonth")}
          placeholder="YYYY-MM"
          value={settings.baseMonth}
          onChange={(event) => onChange({ baseMonth: event.currentTarget.value })}
          error={errors.baseMonth}
        />
        <NumberInput
          label={t("horizonMonths")}
          min={12}
          value={settings.horizonMonths}
          onChange={(value) => onChange({ horizonMonths: Number(value) })}
          error={errors.horizonMonths}
        />
      </Group>

      <Group grow align="flex-start">
        <NumberInput
          label={t("annualInflation")}
          min={-5}
          max={20}
          step={0.1}
          value={settings.annualInflationPct}
          onChange={(value) => onChange({ annualInflationPct: Number(value) })}
          error={errors.annualInflationPct}
        />
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
    </Stack>
  );
}
