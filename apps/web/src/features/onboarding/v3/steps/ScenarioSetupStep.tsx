import { Card, NumberInput, Stack, Text, TextInput } from "@mantine/core";
import { useTranslations } from "next-intl";
import MonthField from "../../../../../components/MonthField";
import { YEAR_MONTH_PLACEHOLDER } from "./monthFieldConstants";
import type { ScenarioDraftV3State } from "../types";

type Props = {
  profile: ScenarioDraftV3State["profile"];
  onChange: (profile: ScenarioDraftV3State["profile"]) => void;
};

export default function ScenarioSetupStep({ profile, onChange }: Props) {
  const t = useTranslations("onboardingV3.steps");

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Stack gap={4}>
            <Text fw={600}>{t("scenarioSetup.title")}</Text>
            <Text size="sm" c="dimmed">{t("scenarioSetup.description")}</Text>
          </Stack>

          <Stack gap="md">
            <TextInput
              label={t("scenarioSetup.fields.baseCurrency")}
              value={profile.baseCurrency ?? ""}
              onChange={(event) => onChange({ ...profile, baseCurrency: event.currentTarget.value.toUpperCase() })}
            />
            <MonthField
              label={t("scenarioSetup.fields.startMonth")}
              placeholder={YEAR_MONTH_PLACEHOLDER}
              value={profile.startMonth ?? ""}
              onChange={(value) => onChange({ ...profile, startMonth: value })}
            />
            <NumberInput
              label={t("scenarioSetup.fields.horizonMonths")}
              min={1}
              value={profile.horizonMonths ?? 0}
              onChange={(value) => onChange({ ...profile, horizonMonths: typeof value === "number" ? value : 360 })}
            />
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}
